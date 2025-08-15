import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import PlayerDashboardModal from "./PlayerDashboardModal";

/** Format YYYY-MM-DD -> DD/MM/YYYY (fallback "—") */
function fmtDate(d) {
  if (!d || typeof d !== "string" || !d.includes("-")) return "—";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return "—";
  return `${day}/${m}/${y}`;
}

export default function PlayersTab({
  userId,
  players = [],
  fetchPlayers,
  sessions = [],
  plans = [],
  gradings = [],
}) {
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [playerForm, setPlayerForm] = useState({
    name: "",
    team: "",
    position: "",
    joined: "",
    dob: "",
    notes: "",
  });

  // Teams list (reads team, falls back to legacy group_name if present)
  const teams = useMemo(
    () =>
      Array.from(
        new Set((players || []).map((p) => p.team || p.group_name).filter(Boolean))
      ),
    [players]
  );

  function resetForm() {
    setEditingPlayerId(null);
    setPlayerForm({
      name: "",
      team: "",
      position: "",
      joined: "",
      dob: "",
      notes: "",
    });
  }

  function editPlayer(p) {
    setEditingPlayerId(p.id);
    setPlayerForm({
      name: p.name || "",
      team: p.team || p.group_name || "",
      position: p.position || "",
      joined: p.joined || "",
      dob: p.dob || p.date_of_birth || p.birthdate || "",
      notes: p.notes || "",
    });
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  }

  async function savePlayer() {
    if (!playerForm.name.trim()) return;

    const existing = players.find((p) => p.id === editingPlayerId);
    const payload = {
      id: editingPlayerId || crypto.randomUUID(),
      user_id: userId,
      name: playerForm.name.trim(),
      team: playerForm.team || null,
      position: playerForm.position || null,
      joined: playerForm.joined || null,
      dob: playerForm.dob || null,
      notes: playerForm.notes || null,
      ...(existing?.belts ? { belts: existing.belts } : {}),
    };

    try {
      if (editingPlayerId) {
        const { error } = await supabase.from("players").update(payload).eq("id", editingPlayerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("players").insert([payload]);
        if (error) throw error;
      }
      resetForm();
      fetchPlayers && fetchPlayers();
    } catch (err) {
      console.error("savePlayer failed:", err);
      alert(`Couldn't save player: ${err.message || err}`);
    }
  }

  async function deletePlayer(id) {
    try {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
      setConfirmDelete(null);
      fetchPlayers && fetchPlayers();
    } catch (err) {
      console.error("deletePlayer failed:", err);
      alert(`Couldn't delete player: ${err.message || err}`);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 app-shell">
      {/* Form */}
      <div className="card">
        <h2 className="section-title">{editingPlayerId ? "Edit player" : "Add player"}</h2>

        <div className="grid md:grid-cols-2 grid-cols-1 gap-3 mb-3">
          <input
            className="input"
            placeholder="Player name"
            value={playerForm.name}
            onChange={(e) => setPlayerForm((s) => ({ ...s, name: e.target.value }))}
          />

          <input
            className="input"
            placeholder="Team / Group"
            value={playerForm.team}
            onChange={(e) => setPlayerForm((s) => ({ ...s, team: e.target.value }))}
            list="teams-list"
          />
          <datalist id="teams-list">
            {teams.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          <input
            className="input"
            placeholder="Position (e.g., Midfield)"
            value={playerForm.position}
            onChange={(e) => setPlayerForm((s) => ({ ...s, position: e.target.value }))}
          />

          <input
            type="date"
            className="input"
            placeholder="Joined"
            value={playerForm.joined}
            onChange={(e) => setPlayerForm((s) => ({ ...s, joined: e.target.value }))}
          />

          <div className="flex flex-col gap-1">
            <input
              type="date"
              className="input"
              placeholder="Date of birth"
              value={playerForm.dob}
              onChange={(e) => setPlayerForm((s) => ({ ...s, dob: e.target.value }))}
            />
            <span className="text-xs text-slate-500">
              Add DoB to enable age-based gradings (U6/U8/…).
            </span>
          </div>
        </div>

        <textarea
          className="input"
          rows={3}
          placeholder="Notes (optional)"
          value={playerForm.notes}
          onChange={(e) => setPlayerForm((s) => ({ ...s, notes: e.target.value }))}
        />

        <div className="flex gap-2 mt-3">
          <button className="btn-primary" onClick={savePlayer}>
            {editingPlayerId ? "Update player" : "Create player"}
          </button>
          {editingPlayerId && (
            <button className="btn btn-outline" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="card">
        <h2 className="section-title">Players</h2>
        <div className="space-y-3">
          {players.map((p) => {
            const dob = p.dob || p.date_of_birth || p.birthdate || null;
            return (
              <div
                key={p.id}
                className="border border-slate-200 rounded-xl p-3"
              >
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  <div className="min-w-0">
                    {/* name */}
                    <p className="font-semibold text-slate-900 truncate">{p.name}</p>

                    {/* chips under name */}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {p.team && (
                        <span className="chip" title={p.team}>
                          <span className="inline-block max-w-[220px] truncate align-bottom">
                            {p.team}
                          </span>
                        </span>
                      )}
                      {p.position && <span className="chip chip--muted">{p.position}</span>}
                    </div>

                    {/* meta line */}
                    <p className="text-xs text-slate-600 mt-1">
                      Joined: {fmtDate(p.joined)} · DoB: {fmtDate(dob)}
                    </p>
                  </div>

                  {/* actions */}
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      className="btn btn-outline btn-chip"
                      onClick={() => setSelectedPlayer(p)}
                    >
                      Dashboard
                    </button>
                    <button
                      className="btn btn-outline btn-chip"
                      onClick={() => editPlayer(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-chip"
                      onClick={() => setConfirmDelete(p)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {players.length === 0 && (
            <p className="text-sm text-slate-500">No players yet.</p>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <h4 className="modal-title">Delete this player?</h4>
            <p>{confirmDelete.name}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => deletePlayer(confirmDelete.id)}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard modal */}
      {selectedPlayer && (
        <PlayerDashboardModal
          player={selectedPlayer}
          sessions={sessions}
          plans={plans}
          gradings={gradings}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
