// src/components/SessionsTab.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/** 1..5 star input */
function StarRating({ value = 0, onChange }) {
  const v = Number(value) || 0;
  return (
    <div className="inline-flex items-center gap-1 whitespace-nowrap select-none">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < v;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i + 1)}
            className={`text-lg leading-none ${filled ? "text-yellow-500" : "text-slate-300"}`}
            title={`${i + 1}`}
            aria-label={`${i + 1} star`}
          >
            ★
          </button>
        );
      })}
      {v ? (
        <button
          type="button"
          className="ml-2 text-xs text-slate-500"
          onClick={() => onChange?.(0)}
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
  /* ---------- Form state ---------- */
  const [form, setForm] = useState({
    date: "",
    type: "",
    planid: "",
    group_name: "",
    location: "",
    time: "",
    expected_attendees: [],
    attendees: [],
    notes: {}, // { [playerId]: { general, fa4:{technical,tactical,physical,social} } }
  });
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

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
      const id = String(pid);
      const exists = s.expected_attendees.some((x) => String(x) === id);
      const expected_attendees = exists
        ? s.expected_attendees.filter((x) => String(x) !== id)
        : [...s.expected_attendees, pid];
      return { ...s, expected_attendees };
    });
  }

  function toggleAttendee(pid) {
    setForm((s) => {
      const id = String(pid);
      const exists = s.attendees.some((x) => String(x) === id);
      const attendees = exists ? s.attendees.filter((x) => String(x) !== id) : [...s.attendees, pid];
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

  function rescheduleSession(s) {
    // Load the session into the form, but as a new record with empty date/time.
    setEditingId(null);
    setForm({
      date: "",
      time: "",
      type: s.type || "",
      planid: s.planid || "",
      group_name: "",
      location: s.location || "",
      expected_attendees: [],
      attendees: [],
      notes: {},
    });
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }

  /** Make/return a plan id if user hasn't chosen one but typed a type/name */
  async function ensurePlanId() {
    if (form.planid) return form.planid;
    if (!form.type) return null;

    // Try to reuse an existing plan (title match, case-insensitive)
    const { data: existing, error: selErr } = await supabase
      .from("plans")
      .select("id")
      .eq("user_id", userId)
      .ilike("title", form.type)
      .maybeSingle();

    if (!selErr && existing) return existing.id;

    // Otherwise create a minimal plan
    const { data, error } = await supabase
      .from("plans")
      .insert([{ user_id: userId, title: form.type }])
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
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
      // Ensure we have a plan if user typed a session name but left plan blank
      const planId = await ensurePlanId();
      if (planId) payload.planid = planId;

      if (editingId) {
        const { error } = await supabase.from("sessions").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sessions").insert(payload);
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
            placeholder="dd/mm/yyyy"
          />
          <input
            type="text"
            className="input"
            value={form.type}
            onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
            placeholder="Session type / name"
          />
          {/* Plan (optional) */}
          <select
            className="input"
            value={form.planid || ""}
            onChange={(e) => setForm((s) => ({ ...s, planid: e.target.value || "" }))}
          >
            <option value="">Plan (optional)</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="input"
            value={form.group_name}
            onChange={(e) => setForm((s) => ({ ...s, group_name: e.target.value }))}
            placeholder="Group name (optional)"
          />
          <input
            type="text"
            className="input"
            value={form.location}
            onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
            placeholder="Location"
          />
          <input
            type="time"
            className="input"
            value={form.time}
            onChange={(e) => setForm((s) => ({ ...s, time: e.target.value }))}
            placeholder="--:--"
          />
        </div>

        {/* Expected attendees */}
        <div className="mb-3">
          <p className="text-sm font-semibold mb-1">Expected attendees</p>
          <div className="max-h-64 overflow-y-auto border rounded-xl p-2">
            {players.map((p) => {
              const checked = form.expected_attendees.some((x) => String(x) === String(p.id));
              return (
                <label key={p.id} className="flex items-center gap-2 py-1">
                  <input type="checkbox" checked={checked} onChange={() => toggleExpected(p.id)} />
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
                      className="mt-0.5"
                    />
                    <span className="text-sm">{p.name}</span>
                  </label>

                  {/* FA4 mini ratings */}
                  {isHere && (
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {["technical", "tactical", "physical", "social"].map((corner) => (
                        <div key={corner} className="flex flex-col items-start">
                          <StarRating
                            value={fa4[corner] || 0}
                            onChange={(val) => updateFa4(p.id, corner, val)}
                          />
                          <span className="text-xs capitalize text-slate-500 mt-1">{corner}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* General note */}
                  {isHere && (
                    <textarea
                      className="input mt-2"
                      rows={2}
                      placeholder="Notes (optional)"
                      value={note.general || ""}
                      onChange={(e) => updateNote(p.id, "general", e.target.value)}
                    />
                  )}
                </div>
              );
            })}
            {players.length === 0 && <p className="text-sm text-slate-500">No players.</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn" onClick={saveSession}>
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
            const plan = plans.find((p) => String(p.id) === String(s.planid));
            return (
              <div key={s.id} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {s.date || "—"} · {s.type || "Session"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Plan: {plan?.title || "—"}
                      {plan?.focus ? ` · Focus: ${plan.focus}` : ""}
                    </p>
                    <p className="text-xs text-slate-600">
                      Expected: {s.expected_attendees?.length || 0} · Attended:{" "}
                      {s.attendees?.length || 0}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button className="btn btn-chip" onClick={() => editSession(s)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-outline btn-chip"
                      onClick={() => rescheduleSession(s)}
                      title="Copy this session into the form to schedule at a new time/group"
                    >
                      Reschedule
                    </button>
                    <button className="btn btn-danger btn-chip" onClick={() => setConfirmDelete(s)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {sessions.length === 0 && (
            <p className="text-sm text-slate-500">No sessions yet. Create your first one ↑</p>
          )}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="text-lg font-semibold">Delete this session?</h3>
            <p className="text-sm text-slate-600 mt-1">
              {confirmDelete.date || "—"} · {confirmDelete.type || "Session"}
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => deleteSession(confirmDelete.id)}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
