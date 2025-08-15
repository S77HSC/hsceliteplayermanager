import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/* ───── Config ───── */
const AREAS = ["Goalkeeping", "Defending", "Midfield", "Attacking", "Soccer Understanding"];
const BELTS = ["White", "Yellow", "Orange", "Green", "Blue", "Red", "Black"];

const AGE_BELT_SPANS = {
  U6:  ["White","Yellow"],
  U8:  ["White","Yellow","Orange"],
  U10: ["Yellow","Orange","Green"],
  U12: ["Orange","Green","Blue"],
  U14: ["Green","Blue","Red"],
  U16: ["Blue","Red","Black"],
};

const AGE_THRESHOLDS = {
  U6:  { pass_percent:60, min_avg_score:4.0, min_attendance:40, min_sessions:6 },
  U8:  { pass_percent:65, min_avg_score:4.5, min_attendance:50, min_sessions:8 },
  U10: { pass_percent:70, min_avg_score:5.0, min_attendance:55, min_sessions:8 },
  U12: { pass_percent:75, min_avg_score:5.5, min_attendance:60, min_sessions:10 },
  U14: { pass_percent:80, min_avg_score:6.0, min_attendance:70, min_sessions:12 },
  U16: { pass_percent:85, min_avg_score:6.5, min_attendance:75, min_sessions:12 },
};

const SKILLS = {
  Goalkeeping: {
    White:"set position, ready stance, safe collection",
    Yellow:"basic diving, footwork cones, rollout",
    Orange:"collapse dive both sides, W-catch, short distribution",
    Green:"parry vs hard shots, 1v1 block, throw/bowl to target",
    Blue:"high ball catch, starting positions, pass both feet",
    Red:"cross decisions, recovery steps, quick distribution",
    Black:"command area, triggers, under-press distribution",
  },
  Defending: {
    White:"side-on shape, slow attacker",
    Yellow:"jockey & delay, pinch inside, block pass",
    Orange:"tackle timing, cover & balance, track runners",
    Green:"defend 2v1, press cues, recovery runs",
    Blue:"back-four line, offside trap, screen & intercept",
    Red:"press triggers, compactness, weak-side cover",
    Black:"zonal/press mix, comms, game management",
  },
  Midfield: {
    White:"receive back foot, simple pass, open body",
    Yellow:"scan pre-receive, wall pass, switch basics",
    Orange:"carry out of pressure, split pass, 3rd-man run",
    Green:"create overloads, triggers, tempo control",
    Blue:"break lines, disguise pass, rotations",
    Red:"positional play, press resistance, switch tempo",
    Black:"dictate game, manipulate blocks, create",
  },
  Attacking: {
    White:"dribble zigzag, push-out touch, instep finish",
    Yellow:"1v1 feint, change pace, finish near/far",
    Orange:"cut-inside shot, overlap/underlap, wall-pass finish",
    Green:"run across defender, volley/cut-back, cross choice",
    Blue:"timed movements, disguise, composure",
    Red:"vs low block, quick combos, counter-press",
    Black:"solve final third, exploit space, ruthless",
  },
  "Soccer Understanding": {
    White:"basic rules, positions, throw-ins",
    Yellow:"when to dribble/pass, roles, restart shape",
    Orange:"transition ideas, width/depth, press basics",
    Green:"combine/overload, risk vs reward",
    Blue:"game plans, nullify strengths, exploit weak",
    Red:"adaptations, manage lead/deficit",
    Black:"read flows, leadership, strategy shifts",
  },
};

/* ───── Helpers ───── */
function cutoffDate(){ return new Date(); } // change to season cutoff if needed
function getDob(p){ return p?.dob || p?.date_of_birth || p?.birthdate || null; }
function ageOn(dateStr, onDate = cutoffDate()){
  if(!dateStr) return null;
  const d = new Date(dateStr);
  let age = onDate.getFullYear() - d.getFullYear();
  const m = onDate.getMonth() - d.getMonth();
  if(m < 0 || (m === 0 && onDate.getDate() < d.getDate())) age--;
  return age;
}
function ageGroupFromDob(dobStr){
  const age = ageOn(dobStr);
  if(age == null) return null;
  if(age <= 5) return "U6";
  if(age <= 7) return "U8";
  if(age <= 9) return "U10";
  if(age <= 11) return "U12";
  if(age <= 13) return "U14";
  return "U16";
}
function nextBeltInSpan(current, span){
  if(!span?.length) return null;
  if(!current) return span[0];
  const i = span.indexOf(current);
  return i === -1 || i === span.length - 1 ? current : span[i+1];
}
function plusMonthsISO(m=4){
  const d = new Date(); d.setMonth(d.getMonth()+m);
  return d.toISOString().slice(0,10);
}
function buildRulesForAge(age, user_id){
  const belts = AGE_BELT_SPANS[age] || [];
  const base  = AGE_THRESHOLDS[age];
  const out=[];
  for(const area of AREAS){
    for(const b of belts){
      out.push({
        id: crypto.randomUUID(),
        user_id,
        area,
        target_belt:b,
        skills: SKILLS[area][b],
        pass_percent: base.pass_percent,
        min_avg_score: base.min_avg_score,
        min_attendance: base.min_attendance,
        min_sessions: base.min_sessions,
      });
    }
  }
  return out;
}

export default function GradingTab({
  userId,
  players = [],
  gradeRules = [],
  gradings = [],
  fetchGradeRules,
  fetchGradings,
}){
  /* ─ UI state ─ */
  const [presetAge, setPresetAge] = useState("U10");

  const [openRules, setOpenRules] = useState(false);
  const [openAdvancedRule, setOpenAdvancedRule] = useState(false);
  const [openScheduled, setOpenScheduled] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);

  // manual schedule form (belt list will be DOB-driven)
  const [scheduleForm, setScheduleForm] = useState({
    player_id:"", area:"", target_belt:"", scheduled_date:"", notes:""
  });

  // rule editor
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    area:"", target_belt:"", skills:"",
    pass_percent:100, min_avg_score:0, min_attendance:0, min_sessions:0,
  });

  // confirmations
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(null);
  const [confirmDeleteGrading, setConfirmDeleteGrading] = useState(null);

  // propose-next modal
  const [nextModal, setNextModal] = useState(null);
  // shape: { player, area, suggestedBelt, dateISO, message, fromRow }

  const playerMap = useMemo(() => Object.fromEntries(players.map(p=>[String(p.id), p])), [players]);

  /* ─ AI presets (rules only now) ─ */
  async function applyPresetRules(){
    if(!userId) return;
    const rules = buildRulesForAge(presetAge, userId);
    const belts = AGE_BELT_SPANS[presetAge] || [];
    await supabase.from("grading_rules").delete().in("target_belt", belts).eq("user_id", userId);
    await supabase.from("grading_rules").insert(rules);
    await fetchGradeRules?.();
  }

  /* ─ Rules CRUD ─ */
  function editRule(r){
    setEditingRuleId(r.id);
    setRuleForm({
      area: r.area||"",
      target_belt: r.target_belt||"",
      skills: r.skills||"",
      pass_percent: Number(r.pass_percent)||0,
      min_avg_score: Number(r.min_avg_score)||0,
      min_attendance: Number(r.min_attendance)||0,
      min_sessions: Number(r.min_sessions)||0,
    });
    setOpenAdvancedRule(true);
  }
  async function saveRule(){
    const payload = {
      id: editingRuleId || crypto.randomUUID(),
      user_id: userId,
      ...ruleForm,
      pass_percent: Number(ruleForm.pass_percent)||0,
      min_avg_score: Number(ruleForm.min_avg_score)||0,
      min_attendance: Number(ruleForm.min_attendance)||0,
      min_sessions: Number(ruleForm.min_sessions)||0,
    };
    if(editingRuleId){
      await supabase.from("grading_rules").update(payload).eq("id", editingRuleId);
    }else{
      await supabase.from("grading_rules").insert([payload]);
    }
    setEditingRuleId(null);
    setRuleForm({ area:"", target_belt:"", skills:"", pass_percent:100, min_avg_score:0, min_attendance:0, min_sessions:0 });
    await fetchGradeRules?.();
  }
  async function deleteRule(id){
    await supabase.from("grading_rules").delete().eq("id", id);
    setConfirmDeleteRule(null);
    await fetchGradeRules?.();
  }

  /* ─ Manual scheduling (DOB drives eligible belts) ─ */
  const selectedPlayer = scheduleForm.player_id ? playerMap[String(scheduleForm.player_id)] : null;
  const selectedAgeGroup = selectedPlayer ? ageGroupFromDob(getDob(selectedPlayer)) : null;
  const eligibleBelts = selectedAgeGroup ? AGE_BELT_SPANS[selectedAgeGroup] : BELTS;

  async function scheduleGrading(){
    const payload = {
      id: crypto.randomUUID(),
      user_id: userId,
      player_id: scheduleForm.player_id,
      area: scheduleForm.area,
      target_belt: scheduleForm.target_belt,
      scheduled_date: scheduleForm.scheduled_date || null,
      status: "scheduled",
      notes: scheduleForm.notes || "",
    };
    await supabase.from("player_gradings").insert([payload]);
    setScheduleForm({ player_id:"", area:"", target_belt:"", scheduled_date:"", notes:"" });
    await fetchGradings?.();
  }

  /* ─ Complete a grading → propose next ─ */
  async function markGrading(id, status){
    const { data: row } = await supabase.from("player_gradings").select("*").eq("id", id).single();
    await supabase.from("player_gradings").update({ status }).eq("id", id);

    // if passed, update player's belts
    if(row && status==="passed" && row.player_id && row.area && row.target_belt){
      const { data: p } = await supabase.from("players").select("belts, dob, date_of_birth, birthdate").eq("id", row.player_id).single();
      const belts = p?.belts || {};
      await supabase.from("players").update({ belts: { ...belts, [row.area]: row.target_belt } }).eq("id", row.player_id);
    }

    // Propose the next grading (both on pass/fail)
    const fullPlayer = players.find(pl => String(pl.id) === String(row.player_id));
    const dob = getDob(fullPlayer);
    const ag = ageGroupFromDob(dob);
    const span = AGE_BELT_SPANS[ag] || [];

    const nextBelt =
      status === "passed"
        ? nextBeltInSpan(row.target_belt, span) || row.target_belt
        : row.target_belt;

    const isTop = span.length && span.indexOf(row.target_belt) === span.length - 1;

    setNextModal({
      player: fullPlayer,
      area: row.area,
      suggestedBelt: nextBelt,
      dateISO: plusMonthsISO(4),
      message:
        !ag
          ? "Player has no DOB — cannot determine age group. Please pick a belt and date."
          : isTop && status === "passed"
          ? `Reached top belt for ${ag}. Propose a review in 4 months (same belt) or adjust manually.`
          : `Next suggested belt for ${ag}: ${nextBelt}.`,
      fromRow: row,
      status,
    });

    await fetchGradings?.();
  }

  async function confirmNextSchedule(){
    if(!nextModal) return;
    const { player, area, suggestedBelt, dateISO, status } = nextModal;
    await supabase.from("player_gradings").insert([{
      id: crypto.randomUUID(),
      user_id: userId,
      player_id: player.id,
      area,
      target_belt: suggestedBelt,
      scheduled_date: dateISO,
      status: "scheduled",
      notes: status === "passed" ? "Proposed after pass" : "Proposed after fail",
    }]);
    setNextModal(null);
    await fetchGradings?.();
  }

  /* ─ Derived views ─ */
  const upcoming = (gradings||[])
    .filter(g=>g.status==="scheduled")
    .sort((a,b)=>new Date(a.scheduled_date||0)-new Date(b.scheduled_date||0));
  const history = (gradings||[])
    .filter(g=>g.status==="passed"||g.status==="failed")
    .sort((a,b)=>new Date(b.scheduled_date||0)-new Date(a.scheduled_date||0));

  /* ─ UI ─ */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 app-shell">
      {/* AI presets — rules only */}
      <div className="card">
        <h2 className="section-title">AI preset (age-based) — create rules</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select className="select" value={presetAge} onChange={(e)=>setPresetAge(e.target.value)}>
            {Object.keys(AGE_BELT_SPANS).map(a=><option key={a}>{a}</option>)}
          </select>
          <button className="btn-primary" onClick={applyPresetRules}>Apply preset rules</button>
        </div>
        <p className="text-sm text-slate-600">
          Belts for {presetAge}: <strong>{(AGE_BELT_SPANS[presetAge]||[]).join(" → ")}</strong>.
          Thresholds scale with age.
        </p>
      </div>

      {/* Quick schedule — belts filtered by player's DOB */}
      <div className="card">
        <h2 className="section-title">Quick schedule</h2>
        {selectedPlayer && (
          <p className="text-sm text-slate-600 mb-2">
            Age group: <strong>{selectedAgeGroup || "Unknown (add DOB)"}</strong> · Eligible belts:{" "}
            <strong>{eligibleBelts.join(" → ")}</strong>
          </p>
        )}
        <div className="grid md:grid-cols-5 grid-cols-2 gap-3 mb-2">
          <select className="select" value={scheduleForm.player_id} onChange={(e)=>setScheduleForm({...scheduleForm, player_id:e.target.value, target_belt:""})}>
            <option value="">Player</option>
            {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select" value={scheduleForm.area} onChange={(e)=>setScheduleForm({...scheduleForm, area:e.target.value})}>
            <option value="">Area</option>
            {AREAS.map(a=><option key={a}>{a}</option>)}
          </select>
          <select className="select" value={scheduleForm.target_belt} onChange={(e)=>setScheduleForm({...scheduleForm, target_belt:e.target.value})} disabled={!selectedPlayer}>
            <option value="">{selectedPlayer ? "Target belt" : "Pick player first"}</option>
            {eligibleBelts.map(b => <option key={b}>{b}</option>)}
          </select>
          <input type="date" className="input" value={scheduleForm.scheduled_date} onChange={(e)=>setScheduleForm({...scheduleForm, scheduled_date:e.target.value})}/>
          <input className="input md:col-span-2" placeholder="Notes (optional)" value={scheduleForm.notes} onChange={(e)=>setScheduleForm({...scheduleForm, notes:e.target.value})}/>
          <button className="btn-primary md:col-span-3" disabled={!scheduleForm.player_id||!scheduleForm.area||!scheduleForm.target_belt} onClick={scheduleGrading}>
            Schedule
          </button>
        </div>
      </div>

      {/* Rules (collapsible) */}
      <div className="card lg:col-span-2">
        <div className="section-head" onClick={()=>setOpenRules(v=>!v)} role="button">
          <h3>Rules <span className="badge">{gradeRules.length}</span></h3>
          <span className={`chev ${openRules?"open":""}`}>▶</span>
        </div>
        <hr className="soft"/>
        {openRules && (
          <>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm text-slate-600">Area & belt-specific criteria used when grading players.</p>
              <button className="btn btn-outline btn-chip" onClick={()=>setOpenAdvancedRule(v=>!v)}>
                {openAdvancedRule ? "Hide advanced" : "Add / edit rule"}
              </button>
            </div>

            {openAdvancedRule && (
              <div className="bg-slate-50 rounded-xl p-3 mb-4">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <select className="select" value={ruleForm.area} onChange={(e)=>setRuleForm({...ruleForm, area:e.target.value})}>
                    <option value="">Area</option>
                    {AREAS.map(a=><option key={a}>{a}</option>)}
                  </select>
                  <select className="select" value={ruleForm.target_belt} onChange={(e)=>setRuleForm({...ruleForm, target_belt:e.target.value})}>
                    <option value="">Target belt</option>
                    {BELTS.map(b=><option key={b}>{b}</option>)}
                  </select>
                </div>
                <input className="input mb-3" placeholder="Skills / topics required (comma separated)"
                  value={ruleForm.skills} onChange={(e)=>setRuleForm({...ruleForm, skills:e.target.value})}/>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <input className="input" type="number" placeholder="Pass %" value={ruleForm.pass_percent} onChange={(e)=>setRuleForm({...ruleForm, pass_percent:e.target.value})}/>
                  <input className="input" type="number" placeholder="Min Avg Score" value={ruleForm.min_avg_score} onChange={(e)=>setRuleForm({...ruleForm, min_avg_score:e.target.value})}/>
                  <input className="input" type="number" placeholder="Min Attendance %" value={ruleForm.min_attendance} onChange={(e)=>setRuleForm({...ruleForm, min_attendance:e.target.value})}/>
                  <input className="input" type="number" placeholder="Min Sessions" value={ruleForm.min_sessions} onChange={(e)=>setRuleForm({...ruleForm, min_sessions:e.target.value})}/>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={saveRule}>{editingRuleId ? "Update rule" : "Save rule"}</button>
                  {editingRuleId && <button className="btn btn-outline" onClick={()=>{ setEditingRuleId(null); setRuleForm({ area:"", target_belt:"", skills:"", pass_percent:100, min_avg_score:0, min_attendance:0, min_sessions:0 }); }}>Cancel</button>}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-2 py-1 text-left">Area</th>
                    <th className="border px-2 py-1 text-left">Belt</th>
                    <th className="border px-2 py-1 text-left">Skills</th>
                    <th className="border px-2 py-1 text-center">Pass %</th>
                    <th className="border px-2 py-1 text-left">Thresholds</th>
                    <th className="border px-2 py-1 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeRules.map(r=>(
                    <tr key={r.id}>
                      <td className="border px-2 py-1">{r.area||"—"}</td>
                      <td className="border px-2 py-1">{r.target_belt||"—"}</td>
                      <td className="border px-2 py-1">{r.skills||"—"}</td>
                      <td className="border px-2 py-1 text-center">{r.pass_percent ?? 0}%</td>
                      <td className="border px-2 py-1">score ≥ {r.min_avg_score ?? 0} · att ≥ {r.min_attendance ?? 0}% · sess ≥ {r.min_sessions ?? 0}</td>
                      <td className="border px-2 py-1 text-center">
                        <div className="plan-actions" style={{justifyContent:"center",marginTop:0}}>
                          <button className="btn btn-outline btn-chip" onClick={()=>editRule(r)}>Edit</button>
                          <button className="btn btn-danger btn-chip" onClick={()=>setConfirmDeleteRule(r)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {gradeRules.length===0 && (
                    <tr><td colSpan={6} className="border px-2 py-3 text-center text-gray-500">No rules yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Scheduled (collapsible) */}
      <div className="card lg:col-span-2">
        <div className="section-head" onClick={()=>setOpenScheduled(v=>!v)} role="button">
          <h3>Scheduled <span className="badge">{upcoming.length}</span></h3>
          <span className={`chev ${openScheduled?"open":""}`}>▶</span>
        </div>
        <hr className="soft"/>
        {openScheduled && (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 text-sm rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1 text-left">Date</th>
                  <th className="border px-2 py-1 text-left">Player</th>
                  <th className="border px-2 py-1 text-left">Area</th>
                  <th className="border px-2 py-1 text-left">Target belt</th>
                  <th className="border px-2 py-1 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(g=>(
                  <tr key={g.id}>
                    <td className="border px-2 py-1">{g.scheduled_date||"—"}</td>
                    <td className="border px-2 py-1">{playerMap[String(g.player_id)]?.name || "—"}</td>
                    <td className="border px-2 py-1">{g.area}</td>
                    <td className="border px-2 py-1">{g.target_belt}</td>
                    <td className="border px-2 py-1 text-center">
                      <div className="plan-actions" style={{justifyContent:"center",marginTop:0}}>
                        <button className="btn btn-outline btn-chip" onClick={()=>markGrading(g.id,"passed")}>Mark Passed</button>
                        <button className="btn btn-outline btn-chip" onClick={()=>markGrading(g.id,"failed")}>Mark Failed</button>
                        <button className="btn btn-danger btn-chip" onClick={()=>setConfirmDeleteGrading(g)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {upcoming.length===0 && (
                  <tr><td colSpan={5} className="border px-2 py-3 text-center text-gray-500">Nothing scheduled.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History (collapsible) */}
      <div className="card lg:col-span-2">
        <div className="section-head" onClick={()=>setOpenHistory(v=>!v)} role="button">
          <h3>History <span className="badge">{history.length}</span></h3>
          <span className={`chev ${openHistory?"open":""}`}>▶</span>
        </div>
        <hr className="soft"/>
        {openHistory && (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 text-sm rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1 text-left">Date</th>
                  <th className="border px-2 py-1 text-left">Player</th>
                  <th className="border px-2 py-1 text-left">Area</th>
                  <th className="border px-2 py-1 text-left">Belt</th>
                  <th className="border px-2 py-1 text-left">Status</th>
                  <th className="border px-2 py-1 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map(g=>(
                  <tr key={g.id}>
                    <td className="border px-2 py-1">{g.scheduled_date||"—"}</td>
                    <td className="border px-2 py-1">{playerMap[String(g.player_id)]?.name || "—"}</td>
                    <td className="border px-2 py-1">{g.area}</td>
                    <td className="border px-2 py-1">{g.target_belt}</td>
                    <td className="border px-2 py-1">{g.status}</td>
                    <td className="border px-2 py-1">{g.notes||"—"}</td>
                  </tr>
                ))}
                {history.length===0 && (
                  <tr><td colSpan={6} className="border px-2 py-3 text-center text-gray-500">No grading history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmations */}
      {confirmDeleteRule && (
        <div className="modal-backdrop">
          <div className="modal">
            <h4 className="modal-title">Delete this rule?</h4>
            <p><strong>{confirmDeleteRule.area}</strong> → <strong>{confirmDeleteRule.target_belt}</strong></p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setConfirmDeleteRule(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>deleteRule(confirmDeleteRule.id)}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteGrading && (
        <div className="modal-backdrop">
          <div className="modal">
            <h4 className="modal-title">Delete this grading?</h4>
            <p>{playerMap[String(confirmDeleteGrading.player_id)]?.name || "Player"} — {confirmDeleteGrading.area} ({confirmDeleteGrading.target_belt})</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setConfirmDeleteGrading(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>deleteGrading(confirmDeleteGrading.id)}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Propose next grading modal */}
      {nextModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h4 className="modal-title">
              Next grading for {nextModal.player?.name} — {nextModal.area}
            </h4>
            <p className="text-sm text-slate-600 mb-2">{nextModal.message}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Target belt</label>
                <select
                  className="select"
                  value={nextModal.suggestedBelt || ""}
                  onChange={(e)=>setNextModal({...nextModal, suggestedBelt:e.target.value})}
                >
                  {(AGE_BELT_SPANS[ageGroupFromDob(getDob(nextModal.player))] || BELTS).map(b=>(
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Proposed date</label>
                <input
                  type="date"
                  className="input"
                  value={nextModal.dateISO}
                  onChange={(e)=>setNextModal({...nextModal, dateISO:e.target.value})}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setNextModal(null)}>Skip</button>
              <button className="btn-primary" onClick={confirmNextSchedule}>Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
