import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// tiny helpers
const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const nextScheduled = (gradings = [], playerId) => {
  const now = new Date().toISOString().slice(0, 10);
  return (gradings || [])
    .filter((g) => String(g.player_id) === String(playerId) && g.status === "scheduled" && (g.scheduled_date || "") >= now)
    .sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""))[0];
};

export default function ParentReportTab({ userId, players, sessions, plans, gradings }) {
  const [playerId, setPlayerId] = useState("");
  const [summary, setSummary] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const player = useMemo(() => players.find((p) => String(p.id) === String(playerId)), [players, playerId]);

  // build the same session list you use elsewhere (plan name/focus pulled via planid)
  const playerSessions = useMemo(() => {
    if (!playerId) return [];
    const byDate = (a, b) => new Date(a.date) - new Date(b.date);
    return (sessions || [])
      .filter(
        (s) =>
          (s.attendees || []).includes(playerId) ||
          (s.expected_attendees || []).includes(playerId)
      )
      .sort(byDate)
      .map((s) => ({
        ...s,
        planTitle: plans.find((p) => p.id === s.planid)?.title || "—",
        planFocus: plans.find((p) => p.id === s.planid)?.focus || "—",
      }));
  }, [sessions, plans, playerId]);

  // simple attendance + four-corners average
  const attended = useMemo(() => playerSessions.filter((s) => (s.attendees || []).includes(playerId)).length, [playerSessions, playerId]);
  const scheduled = useMemo(() => playerSessions.length, [playerSessions]);
  const attendancePct = scheduled ? Math.round((attended / scheduled) * 100) : 0;

  const avgFa4 = useMemo(() => {
    const acc = { technical: 0, tactical: 0, physical: 0, social: 0, n: 0 };
    for (const s of playerSessions) {
      const note = s.notes?.[playerId];
      const fa = note?.fa4;
      if (!fa) continue;
      acc.technical += Number(fa.technical || 0);
      acc.tactical += Number(fa.tactical || 0);
      acc.physical += Number(fa.physical || 0);
      acc.social += Number(fa.social || 0);
      acc.n++;
    }
    if (!acc.n) return null;
    return {
      technical: (acc.technical / acc.n).toFixed(1),
      tactical: (acc.tactical / acc.n).toFixed(1),
      physical: (acc.physical / acc.n).toFixed(1),
      social: (acc.social / acc.n).toFixed(1),
    };
  }, [playerSessions, playerId]);

  // history for this player
  async function fetchHistory(pid) {
    if (!pid) return setHistory([]);
    const { data, error } = await supabase
      .from("parent_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("player_id", pid)
      .order("created_at", { ascending: false });
    if (!error) setHistory(data || []);
  }
  useEffect(() => { fetchHistory(playerId); }, [playerId]);

  // Generate → upload → insert history
  const reportRef = useRef(null);
  async function generatePdf() {
    if (!player) return;
    setLoading(true);
    try {
      // 1) capture DOM → canvas
      const node = reportRef.current;
      const canvas = await html2canvas(node, { scale: 2, useCORS: true });
      const png = canvas.toDataURL("image/png");

      // 2) put into a PDF (A4 portrait)
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const maxW = pageWidth - 60; // 30pt margins
      const ratio = maxW / canvas.width;
      const imgW = maxW;
      const imgH = canvas.height * ratio;
      pdf.addImage(png, "PNG", 30, 30, imgW, imgH);
      const blob = pdf.output("blob");

      // 3) upload to storage
      const fileName = `${new Date().toISOString().replaceAll(":","-")}-${player.name}.pdf`;
      const path = `${userId}/${player.id}/${fileName}`;
      const { error: upErr } = await supabase.storage.from("reports").upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      // 4) insert history row
      const upcoming = nextScheduled(gradings, player.id);
      const upcomingJson = upcoming
        ? { date: upcoming.scheduled_date, area: upcoming.area, belt: upcoming.target_belt }
        : null;

      const { error: insErr } = await supabase.from("parent_reports").insert([{
        user_id: userId,
        player_id: player.id,
        summary,
        pdf_path: path,
        upcoming: upcomingJson,
      }]);
      if (insErr) throw insErr;

      // refresh list
      setSummary("");
      await fetchHistory(player.id);
      alert("Report saved to history.");
    } catch (e) {
      console.error(e);
      alert("Couldn't generate report: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const { data: _u } =
    supabase.storage.from("reports").getPublicUrl("x"); // warms types; safe no-op

  function publicUrl(path) {
    return supabase.storage.from("reports").getPublicUrl(path).data.publicUrl;
  }

  return (
    <div className="app-shell grid gap-5">
      <div className="card">
        <h2 className="section-title">Parent report</h2>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <select className="select" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Select a player</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input
            className="input md:col-span-2"
            placeholder="One-line report summary (appears on the PDF and in history)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        {/* Printable report body */}
        {player && (
          <div ref={reportRef} className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold">{player.name}</h3>
                <p className="text-sm text-slate-600">
                  Team: {player.team || "—"} · Position: {player.position || "—"} · DoB: {fmt(player.dob)}
                </p>
                <p className="text-sm text-slate-600">
                  Report date: {fmt(new Date().toISOString())}
                </p>
              </div>
            </div>

            {summary && (
              <div className="mb-3 text-slate-800">
                <strong>Summary: </strong>{summary}
              </div>
            )}

            {/* “Dashboard as centre piece” (compact) */}
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-xl p-3 bg-slate-50">
                <p className="text-sm font-semibold mb-1">Attendance</p>
                <p className="text-2xl font-bold">{attendancePct}%</p>
                <p className="text-xs text-slate-600">{attended}/{scheduled} sessions</p>
              </div>

              <div className="rounded-xl p-3 bg-slate-50">
                <p className="text-sm font-semibold mb-1">FA 4 Corners (avg)</p>
                {avgFa4 ? (
                  <ul className="text-sm space-y-1">
                    <li>Technical: {avgFa4.technical}</li>
                    <li>Tactical: {avgFa4.tactical}</li>
                    <li>Physical: {avgFa4.physical}</li>
                    <li>Social: {avgFa4.social}</li>
                  </ul>
                ) : (
                  <p className="text-xs text-slate-600">No ratings yet.</p>
                )}
              </div>

              <div className="rounded-xl p-3 bg-slate-50">
                <p className="text-sm font-semibold mb-1">Upcoming grading</p>
                {(() => {
                  const u = nextScheduled(gradings, player.id);
                  return u ? (
                    <div className="text-sm">
                      <div>{fmt(u.scheduled_date)}</div>
                      <div>{u.area} → {u.target_belt}</div>
                    </div>
                  ) : <p className="text-xs text-slate-600">None scheduled.</p>;
                })()}
              </div>
            </div>

            {/* Session history (plan title/focus/details already merged) */}
            <div className="mt-4">
              <p className="text-sm font-semibold mb-2">Session history</p>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-sm rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-2 py-1 text-left">Date</th>
                      <th className="border px-2 py-1 text-left">Plan</th>
                      <th className="border px-2 py-1 text-left">Focus</th>
                      <th className="border px-2 py-1 text-left">Session</th>
                      <th className="border px-2 py-1 text-left">Engagement</th>
                      <th className="border px-2 py-1 text-left">Feedback</th>
                      <th className="border px-2 py-1 text-left">FA 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerSessions.map((s) => {
                      const note = s.notes?.[playerId] || {};
                      const fa = note.fa4 || {};
                      const faStr = ["technical","tactical","physical","social"]
                        .map(k => fa[k] ? `${k[0].toUpperCase()+k.slice(1)} ${fa[k]}/5` : null)
                        .filter(Boolean).join(" · ");
                      return (
                        <tr key={s.id}>
                          <td className="border px-2 py-1">{fmt(s.date)}</td>
                          <td className="border px-2 py-1">{s.planTitle}</td>
                          <td className="border px-2 py-1">{s.planFocus}</td>
                          <td className="border px-2 py-1">{s.type || "—"}</td>
                          <td className="border px-2 py-1">{note.score ?? "—"}</td>
                          <td className="border px-2 py-1">{note.general || note.feedback || "—"}</td>
                          <td className="border px-2 py-1">{faStr || "—"}</td>
                        </tr>
                      );
                    })}
                    {playerSessions.length === 0 && (
                      <tr><td colSpan={7} className="border px-2 py-2 text-center text-slate-500">No sessions yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button className="btn-primary" disabled={!player || loading} onClick={generatePdf}>
            {loading ? "Generating…" : "Generate PDF & Save"}
          </button>
        </div>
      </div>

      {/* History */}
      {player && (
        <div className="card">
          <h3 className="section-title">Report history — {player.name}</h3>
          <div className="space-y-2">
            {history.map((r) => (
              <div key={r.id} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{fmt(r.created_at)}</p>
                  <p className="text-sm text-slate-600 truncate">{r.summary || "—"}</p>
                  {r.upcoming && (
                    <p className="text-xs text-slate-600">
                      Upcoming: {fmt(r.upcoming.date)} · {r.upcoming.area} → {r.upcoming.belt}
                    </p>
                  )}
                </div>
                <a className="btn btn-outline btn-chip" href={publicUrl(r.pdf_path)} target="_blank" rel="noreferrer">Open PDF</a>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-slate-500">No previous reports.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
