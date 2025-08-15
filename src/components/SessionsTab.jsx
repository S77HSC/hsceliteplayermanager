// src/components/SessionsTab.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/** Small star component for 1..5 */
function StarRating({ value = 0, onChange }) {
  const v = Number(value) || 0;
  return (
    <div className="inline-flex items-center gap-1 whitespace-nowrap select-none relative z-10">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < v;
        return (
          <button
            key={i}
            type="button"
            className={`text-lg leading-none ${filled ? "text-yellow-500" : "text-slate-300"}`}
            onClick={() => onChange(i + 1)}
            aria-label={`Set to ${i + 1}`}
          >
            ★
          </button>
        );
      })}
      {v ? (
        <button
          type="button"
          className="ml-2 text-xs text-slate-500"
          onClick={() => onChange(0)}
          title="Clear rating"
          aria-label="Clear rating"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export default function SessionsTab({
  userId,
  players = [],
  plans = [],
  sessions = [],
  fetchSessions,
  /** prefill object from PlansTab: {planid, type, location, time} */
  prefillFromPlan = null,
  /** tell App we consumed the prefill */
  onPrefillConsumed,
}) {
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [form, setForm] = useState({
    date: "",
    type: "",
    planid: "",
    group_name: "",
    location: "",
    time: "",
    expected_attendees: [],
    attendees: [],
    notes: {}, // { [playerId]: { score, general, fa4:{technical,tactical,physical,social} } }
  });

  /* ---------- Helpers ---------- */
  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [String(p.id), p])),
    [players]
  );

  function resetForm() {
    setEditingId(null);
    setForm({
      date: "",
      type: "",
      planid: "",
      group_name: "",
      location: "",
      time: "",
      expected_attendees: [],
      attendees: [],
      notes: {},
    });
  }

  function toggleExpected(pid) {
    setForm((s) => {
      const exists = s.expected_attendees.some((x) => String(x) === String(pid));
      const expected_attendees = exists
        ? s.expected_attendees.filter((x) => String(x) !== String(pid))
        : [...s.expected_attendees, pid];
      return { ...s, expected_attendees };
    });
  }

  function toggleAttendee(pid) {
    setForm((s) => {
      const exists = s.attendees.some((x) => String(x) === String(pid));
      const attendees = exists
        ? s.attendees.filter((x) => String(x) !== String(pid))
        : [...s.attendees, pid];
      return { ...s, attendees };
    });
  }

  function updateNote(pid, key, value) {
    setForm((s) => {
      const cur = s.notes?.[pid] || {};
      const next = { ...cur, [key]: value };
      return { ...s, notes: { ...s.notes, [pid]: next } };
    });
  }

  function updateFa4(pid, corner, value) {
    setForm((s) => {
      const cur = s.notes?.[pid] || {};
      const fa4 = { ...(cur.fa4 || {}), [corner]: value };
      const next = { ...cur, fa4 };
      return { ...s, notes: { ...s.notes, [pid]: next } };
    });
  }

  function editSession(sess) {
    setEditingId(sess.id);
    setForm({
      date: sess.date || "",
      type: sess.type || "",
      planid: sess.planid || "",
      group_name: sess.group_name || "",
      location: sess.location || "",
      time: sess.time || "",
      expected_attendees: sess.expected_attendees || [],
      attendees: sess.attendees || [],
      notes: sess.notes || {},
    });
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }

  async function saveSession() {
    const payload = {
      id: editingId || crypto.randomUUID(),
      user_id: userId,
      date: form.date || null,
      type: form.type || null,
      planid: form.planid || null,
      group_name: form.group_name || null,
      location: form.location || null,
      time: form.time || null,
      expected_attendees: form.expected_attendees || [],
      attendees: form.attendees || [],
      notes: form.notes || {},
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("sessions").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sessions").insert([payload]);
        if (error) throw error;
      }
      resetForm();
      fetchSessions && fetchSessions();
    } catch (e) {
      console.error(e);
      alert(`Couldn't save session: ${e.message || e}`);
    }
  }

  async function deleteSession(id) {
    try {
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw error;
      setConfirmDelete(null);
      fetchSessions && fetchSessions();
    } catch (e) {
      console.error(e);
      alert(`Couldn't delete: ${e.message || e}`);
    }
  }

  /* ---------- Prefill from a plan (coming from PlansTab) ---------- */
  useEffect(() => {
    if (!prefillFromPlan) return;
    setForm((s) => ({
      ...s,
      date: s.date || new Date().toISOString().slice(0, 10),
      type: prefillFromPlan.type || s.type || "",
      planid: prefillFromPlan.planid || s.planid || "",
      location: prefillFromPlan.location || s.location || "",
      time: prefillFromPlan.time || s.time || "",
    }));
    onPrefillConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillFromPlan]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 app-shell">
      {/* Form */}
      <div className="card">
        <h2 className="section-title">{editingId ? "Edit session" : "Add session"}</h2>

        <div className="grid md:grid-cols-2 grid-cols-1 gap-3 mb-3">
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Session type / name"
            value={form.type}
            onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
          />

          <select
            className="select"
            value={form.planid}
            onChange={(e) => setForm((s) => ({ ...s, planid: e.target.value }))}
          >
            <option value="">Plan (optional)</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <input
            className="input"
            placeholder="Group name (optional)"
            value={form.group_name}
            onChange={(e) => setForm((s) => ({ ...s, group_name: e.target.value }))}
          />

          <input
            className="input"
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
          />
          <input
            type="time"
            className="input"
            placeholder="Time"
            value={form.time}
            onChange={(e) => setForm((s) => ({ ...s, time: e.target.value }))}
          />
        </div>

        {/* Expected attendees */}
        <div className="mb-3">
          <p className="text-sm font-semibold mb-1">Expected attendees</p>
          <div className="max-h-48 overflow-y-auto border rounded-xl p-2">
            {players.map((p) => {
              const checked = form.expected_attendees.some((x) => String(x) === String(p.id));
              return (
                <label key={p.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleExpected(p.id)}
                  />
                  <span className="text-sm">{p.name}</span>
                </label>
              );
            })}
            {players.length === 0 && <p className="text-sm text-slate-500">No players.</p>}
          </div>
        </div>

        {/* Actual attendees + feedback */}
        <div className="mb-3">
          <p className="text-sm font-semibold mb-1">Actual attendees</p>
          <div className="max-h-96 overflow-y-auto border rounded-xl p-2">
            {players.map((p) => {
              const isHere = form.attendees.some((x) => String(x) === String(p.id));
              const note = form.notes?.[p.id] || {};
              const fa4 = note.fa4 || {};
              return (
                <div key={p.id} className="py-2 border-b last:border-b-0">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isHere}
                      onChange={() => toggleAttendee(p.id)}
                    />
                    <span className="text-sm">{p.name}</span>
                  </label>

                  {isHere && (
                    <div className="ml-6 mt-2 space-y-2">
                      <div className="grid md:grid-cols-3 grid-cols-1 gap-2">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          className="input"
                          placeholder="Engagement score (1–10)"
                          value={note.score ?? ""}
                          onChange={(e) => updateNote(p.id, "score", e.target.value ? Number(e.target.value) : null)}
                        />
                        <div className="md:col-span-2">
                          <input
                            className="input"
                            placeholder="General feedback"
                            value={note.general || ""}
                            onChange={(e) => updateNote(p.id, "general", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* FA4 ratings: labels under stars to avoid overlap */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {["technical", "tactical", "physical", "social"].map((corner) => (
                          <div key={corner} className="flex flex-col items-start">
                            <StarRating
                              value={fa4[corner] || 0}
                              onChange={(val) => updateFa4(p.id, corner, val)}
                            />
                            <span className="text-xs capitalize text-slate-600 mt-1">{corner}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" onClick={saveSession}>
            {editingId ? "Update session" : "Save session"}
          </button>
          {editingId && (
            <button className="btn btn-outline" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="card">
        <h2 className="section-title">Sessions</h2>
        <div className="space-y-3">
          {sessions.map((s) => {
            const plan = plans.find((p) => p.id === s.planid);
            return (
              <div key={s.id} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {s.date || "—"} · {s.type || "Session"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Plan: {plan?.title || "—"}{plan?.focus ? ` · Focus: ${plan.focus}` : ""}
                    </p>
                    <p className="text-xs text-slate-600">
                      Expected: {s.expected_attendees?.length || 0} · Attended: {s.attendees?.length || 0}
                    </p>
                  </div>
                  <div className="plan-actions" style={{ marginTop: 0 }}>
                    <button className="btn btn-outline btn-chip" onClick={() => editSession(s)}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-chip" onClick={() => setConfirmDelete(s)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {sessions.length === 0 && <p className="text-sm text-slate-500">No sessions yet.</p>}
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h4 className="modal-title">Delete this session?</h4>
            <p>
              {confirmDelete.date || "—"} · {confirmDelete.type || "Session"}
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => deleteSession(confirmDelete.id)}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
