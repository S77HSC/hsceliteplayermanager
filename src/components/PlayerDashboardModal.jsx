import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

export default function PlayerDashboardModal({
  player,
  sessions = [],
  plans = [],
  gradings = [],      // ⬅️ new
  onClose
}) {
  const [expanded, setExpanded] = useState([]);

  if (!player) return null;

  // Plan lookup (robust to key names + id types)
  const planMap = useMemo(
    () => Object.fromEntries((plans || []).map(pl => [String(pl.id), pl])),
    [plans]
  );
  const getPlanForSession = (s) => {
    const pid = s.planid ?? s.planId ?? s.plan_id ?? s.plan ?? null;
    return pid == null ? null : (planMap[String(pid)] || null);
  };

  // Sessions for this player (expected OR attended), oldest → newest
  const playerSessions = useMemo(() => {
    return (sessions || [])
      .filter(
        (s) =>
          (s.attendees || []).includes(player.id) ||
          (s.expected_attendees || []).includes(player.id)
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [sessions, player.id]);

  // Attendance %
  const attendancePct = useMemo(() => {
    const total = playerSessions.length;
    if (!total) return 0;
    const attended = playerSessions.filter((s) => (s.attendees || []).includes(player.id)).length;
    return Math.round((attended / total) * 100);
  }, [playerSessions, player.id]);

  // Avg engagement
  const avgScore = useMemo(() => {
    const scores = playerSessions
      .map((s) => Number(s.notes?.[player.id]?.score))
      .filter((n) => !Number.isNaN(n));
    if (!scores.length) return null;
    const sum = scores.reduce((a, b) => a + b, 0);
    return (sum / scores.length).toFixed(1);
  }, [playerSessions, player.id]);

  // FA4 trend
  const trendData = useMemo(
    () =>
      playerSessions.map((s) => {
        const fa4 = s.notes?.[player.id]?.fa4 || {};
        return {
          date: s.date,
          Technical: Number(fa4.technical) || 0,
          Tactical: Number(fa4.tactical) || 0,
          Physical: Number(fa4.physical) || 0,
          Social: Number(fa4.social) || 0,
        };
      }),
    [playerSessions, player.id]
  );

  // Radar averages
  const radarData = useMemo(() => {
    const corners = ["Technical", "Tactical", "Physical", "Social"];
    return corners.map((label) => {
      const vals = trendData.map((d) => Number(d[label]) || 0);
      const count = vals.filter((v) => v > 0).length;
      const avg = count ? vals.reduce((a, b) => a + b, 0) / count : 0;
      return { corner: label, value: avg };
    });
  }, [trendData]);

  // Grading history for this player
  const playerGradings = useMemo(() => {
    return (gradings || [])
      .filter((g) => String(g.player_id) === String(player.id))
      .sort((a, b) => new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0));
  }, [gradings, player.id]);

  // Helpers
  const renderStars = (count) => {
    const num = Number(count) || 0;
    return Array.from({ length: 5 }, (_, i) => (i < num ? "★" : "☆")).join("");
  };
  const attendanceSymbol = (s) => {
    if ((s.attendees || []).includes(player.id)) return "✅";
    if ((s.expected_attendees || []).includes(player.id)) return "❌";
    return "";
  };
  const sessionType = (s) => s.type ?? s.sessionType ?? s.name ?? s.title ?? "—";
  const toggleExpand = (id) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[92vh] overflow-y-auto relative p-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black text-lg"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-2">{player.name} — Dashboard</h2>
        <p className="mb-4 text-sm text-gray-700">
          Attendance: {attendancePct}% &nbsp;|&nbsp; Avg Engagement: {avgScore ?? "N/A"}/10
        </p>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* FA 4 Corners Trend */}
          <div className="bg-gray-50 p-4 rounded shadow">
            <h3 className="font-semibold mb-2">FA 4 Corners — Progress Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <XAxis dataKey="date" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Technical" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 3 }} strokeDasharray="6 6" />
                <Line type="monotone" dataKey="Tactical"  stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 3 }} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Physical"  stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 3 }} strokeDasharray="3 6" />
                <Line type="monotone" dataKey="Social"    stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 3 }} strokeDasharray="2 6" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Averages */}
          <div className="bg-gray-50 p-4 rounded shadow">
            <h3 className="font-semibold mb-2">FA 4 Corners — Current Averages</h3>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius={90}>
                <PolarGrid />
                <PolarAngleAxis dataKey="corner" />
                <PolarRadiusAxis domain={[0, 5]} />
                <Radar name="Avg" dataKey="value" stroke="#6b7280" fill="#6b7280" fillOpacity={0.18} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Session History */}
        <h3 className="font-semibold mb-2">Session History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">Date</th>
                <th className="border px-2 py-1 text-left">Session</th>
                <th className="border px-2 py-1 text-center">Attendance</th>
                <th className="border px-2 py-1 text-center">Engagement</th>
                <th className="border px-2 py-1 text-left">General Feedback</th>
                <th className="border px-2 py-1 text-left">FA 4 Corners</th>
                <th className="border px-2 py-1 text-center">Expand</th>
              </tr>
            </thead>
            <tbody>
              {playerSessions.map((s) => {
                const note = s.notes?.[player.id] || {};
                const fa4 = note.fa4 || {};
                const plan = getPlanForSession(s);
                const label = plan ? `${plan.title} — ${sessionType(s)}` : sessionType(s);
                const isOpen = expanded.includes(s.id);

                return (
                  <React.Fragment key={s.id}>
                    <tr className={`align-top ${isOpen ? "bg-gray-50" : ""}`}>
                      <td className="border px-2 py-1 whitespace-nowrap">{s.date}</td>
                      <td className="border px-2 py-1">{label}</td>
                      <td className="border px-2 py-1 text-center">{attendanceSymbol(s)}</td>
                      <td className="border px-2 py-1 text-center">{note.score ?? "N/A"}</td>
                      <td className="border px-2 py-1">{note.general || "—"}</td>
                      <td className="border px-2 py-1 text-yellow-500">
                        {["technical", "tactical", "physical", "social"].map((corner) => (
                          <div key={corner}>
                            <span className="capitalize text-gray-700">{corner}:</span>{" "}
                            <span>{renderStars(fa4[corner])}</span>
                          </div>
                        ))}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        <button className="text-blue-600 hover:underline" onClick={() => toggleExpand(s.id)}>
                          {isOpen ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="border px-4 py-3 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="font-semibold mb-1">Plan Title</p>
                              <p>{plan?.title || "—"}</p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">Plan Focus</p>
                              <p>{plan?.focus || s.focus || "—"}</p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">Session Type</p>
                              <p>{sessionType(s)}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <p className="font-semibold mb-1">Plan Description</p>
                            <p className="text-gray-700">
                              {plan?.description || s.description || "—"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {playerSessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="border px-2 py-3 text-center text-gray-500">
                    No sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Grading History */}
        <h3 className="font-semibold mt-6 mb-2">Grading History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">Date</th>
                <th className="border px-2 py-1 text-left">Area</th>
                <th className="border px-2 py-1 text-left">Belt</th>
                <th className="border px-2 py-1 text-left">Status</th>
                <th className="border px-2 py-1 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {playerGradings.map((g) => (
                <tr key={g.id}>
                  <td className="border px-2 py-1">{g.scheduled_date || "—"}</td>
                  <td className="border px-2 py-1">{g.area}</td>
                  <td className="border px-2 py-1">{g.target_belt}</td>
                  <td className="border px-2 py-1">{g.status}</td>
                  <td className="border px-2 py-1">{g.notes || "—"}</td>
                </tr>
              ))}
              {playerGradings.length === 0 && (
                <tr>
                  <td colSpan={5} className="border px-2 py-3 text-center text-gray-500">
                    No gradings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
