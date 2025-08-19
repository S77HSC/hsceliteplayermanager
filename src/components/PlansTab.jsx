import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * PlansTab (compact layout, no Router dependency)
 * - Left: condensed 2-column plan form (no inner scroll)
 * - Right: session design picker (smaller search input)
 *
 * Now shows designs saved in:
 *  1) Supabase table: session_designs
 *  2) localStorage key: "epm_sessions_v1" (Designer compatibility)
 */
export default function PlansTab({ userId, onOpenDesigner }) {
  /* ── Plan form state ────────────────────────────────────── */
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState("");
  const [format, setFormat] = useState("General");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [defaultTime, setDefaultTime] = useState("");
  const [notesTech, setNotesTech] = useState("");
  const [notesPhys, setNotesPhys] = useState("");
  const [notesPsy, setNotesPsy] = useState("");
  const [notesSoc, setNotesSoc] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [linkedDesign, setLinkedDesign] = useState(null);
  const [saving, setSaving] = useState(false);

  /* ── Session designs (Supabase + localStorage) ──────────── */
  const DESIGN_STORAGE_KEY = "epm_sessions_v1";

  const [designs, setDesigns] = useState([]); // unified list
  const [designSearch, setDesignSearch] = useState("");
  const [loadingDesigns, setLoadingDesigns] = useState(true);

  // Map a localStorage designer entry into the same shape we use from Supabase
  const mapLocalDesign = (d) => ({
    id: d.id,
    user_id: userId || null,
    name: d.name || "Untitled Session",
    pitch: d.pitch || d?.meta?.pitch || "full",
    data: { items: d.items || [], keyframesById: d.keyframesById || {} },
    thumbnail_url: d.thumbnail_url || d.design_thumb || null,
    _source: "local",
  });

  const loadLocalDesigns = () => {
    try {
      const raw = localStorage.getItem(DESIGN_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(mapLocalDesign) : [];
    } catch {
      return [];
    }
  };

  const fetchSupabaseDesigns = async () => {
    if (!userId) return { rows: [], error: null };
    const { data, error } = await supabase
      .from("session_designs")
      .select("id, user_id, name, pitch, data, thumbnail_url")
      .eq("user_id", userId)
      .order("id", { ascending: false });
    return { rows: data || [], error };
  };

  const refreshDesigns = async () => {
    setLoadingDesigns(true);
    const local = loadLocalDesigns();
    const { rows: supaRows } = await fetchSupabaseDesigns();

    // De-dupe by id, prefer Supabase entries when both exist
    const map = new Map();
    for (const r of local) map.set(r.id, r);
    for (const r of supaRows) map.set(r.id, { ...r, _source: "supabase" });

    const merged = Array.from(map.values());
    // Most-recent first: put Supabase first, then locals (you can change this)
    merged.sort((a, b) => (a._source === "supabase" ? -1 : 1));
    setDesigns(merged);
    setLoadingDesigns(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refreshDesigns();
      // when localStorage changes (e.g., Designer saved), refresh the list
      const onStorage = (e) => {
        if (e.key === DESIGN_STORAGE_KEY) refreshDesigns();
      };
      window.addEventListener("storage", onStorage);
      if (!mounted) window.removeEventListener("storage", onStorage);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const filteredDesigns = useMemo(() => {
    const q = designSearch.trim().toLowerCase();
    if (!q) return designs;
    return designs.filter(
      (d) => d.name?.toLowerCase().includes(q) || d.pitch?.toLowerCase().includes(q)
    );
  }, [designs, designSearch]);

  /* ── Plans repository ───────────────────────────────────── */
  const [plans, setPlans] = useState([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [loadingPlans, setLoadingPlans] = useState(true);

  const fetchPlans = async () => {
    if (!userId) return;
    setLoadingPlans(true);
    const { data, error } = await supabase
      .from("plans")
      .select("id, title, focus, format, topics, design_id, design_name, design_thumb")
      .eq("user_id", userId)
      .order("id", { ascending: false });
    if (!error) setPlans(data || []);
    setLoadingPlans(false);
  };

  useEffect(() => {
    fetchPlans();
  }, [userId]);

  const filteredPlans = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) =>
      p.title?.toLowerCase().includes(q) ||
      p.focus?.toLowerCase().includes(q) ||
      p.format?.toLowerCase().includes(q) ||
      (Array.isArray(p.topics)
        ? p.topics.join(", ").toLowerCase().includes(q)
        : (p.topics || "").toLowerCase().includes(q))
    );
  }, [plans, repoSearch]);

  /* ── File pick ──────────────────────────────────────────── */
  const onPickFiles = (e) => setAttachmentFiles(Array.from(e.target.files || []));

  /* ── Open Designer (no Router required) ─────────────────── */
  const openDesigner = (designId) => {
    // hand off the ID so the Designer can auto-open
    try {
      if (designId) localStorage.setItem("epm_open_design_id", designId);
    } catch {}

    if (typeof onOpenDesigner === "function") {
      onOpenDesigner(designId);
      return;
    }
    try {
      window.dispatchEvent(
        new CustomEvent("epm:openDesigner", { detail: { designId } })
      );
    } catch {}
    try {
      window.location.hash = designId ? `#designer:${designId}` : "#designer";
    } catch {}
  };

  /* ── Save plan ──────────────────────────────────────────── */
  const onSavePlan = async () => {
    if (!userId) return alert("Please sign in.");
    if (!title.trim()) return alert("Give the plan a title.");

    setSaving(true);

    const attachmentPaths = []; // upload to storage if needed

    const payload = {
      user_id: userId,
      title: title.trim(),
      focus: focus.trim(),
      description,
      topics,
      format,
      defaultLocation,
      defaultTime,
      fourCorners: {
        technical: notesTech,
        physical: notesPhys,
        psychological: notesPsy,
        social: notesSoc,
      },
      attachmentPaths,
      design_id: linkedDesign?.id || null,
      design_name: linkedDesign?.name || null,
      design_thumb: linkedDesign?.thumbnail_url || null,
    };

    const { error } = await supabase.from("plans").insert(payload);
    setSaving(false);

    if (error) {
      console.error(error);
      alert(
        "Failed to save plan. Verify your 'plans' columns match the payload."
      );
      return;
    }

    await fetchPlans();
    clearForm();
    alert("Plan saved.");
  };

  const clearForm = () => {
    setTitle("");
    setFocus("");
    setDescription("");
    setTopics("");
    setFormat("General");
    setDefaultLocation("");
    setDefaultTime("");
    setNotesTech("");
    setNotesPhys("");
    setNotesPsy("");
    setNotesSoc("");
    setAttachmentFiles([]);
    setLinkedDesign(null);
  };

  /* ── UI ─────────────────────────────────────────────────── */
  return (
    <div className="p-4">
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT: compact 2-column form (no inner scrolling) */}
        <div className="col-span-12 lg:col-span-6">
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <h2 className="text-2xl font-semibold mb-3">Create plan</h2>

            {/* two-column form grid */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plan title" span={2}>
                <input
                  className="w-full px-3 py-2 rounded-xl border"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>

              <Field label="Focus (e.g., Turning, Pressing)" span={2}>
                <input
                  className="w-full px-3 py-2 rounded-xl border"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                />
              </Field>

              <Field label="Description / coaching points" span={2}>
                <textarea
                  className="w-full h-[96px] p-2 rounded-xl border"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>

              <Field label="Topics (comma separated)" span={2}>
                <input
                  className="w-full px-3 py-2 rounded-xl border"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                />
              </Field>

              <Field label="Format">
                <input
                  className="w-full px-3 py-2 rounded-xl border"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                />
              </Field>
              <Field label="Default location">
                <input
                  className="w-full px-3 py-2 rounded-xl border"
                  value={defaultLocation}
                  onChange={(e) => setDefaultLocation(e.target.value)}
                />
              </Field>

              <Field label="Default time" span={2}>
                <input
                  type="time"
                  className="w-full px-3 py-2 rounded-xl border"
                  value={defaultTime}
                  onChange={(e) => setDefaultTime(e.target.value)}
                />
              </Field>

              {/* Four corners in a 2x2 grid */}
              <Field label="Technical notes">
                <textarea
                  className="w-full h-[80px] p-2 rounded-xl border"
                  value={notesTech}
                  onChange={(e) => setNotesTech(e.target.value)}
                />
              </Field>
              <Field label="Physical notes">
                <textarea
                  className="w-full h-[80px] p-2 rounded-xl border"
                  value={notesPhys}
                  onChange={(e) => setNotesPhys(e.target.value)}
                />
              </Field>
              <Field label="Psychological notes">
                <textarea
                  className="w-full h-[80px] p-2 rounded-xl border"
                  value={notesPsy}
                  onChange={(e) => setNotesPsy(e.target.value)}
                />
              </Field>
              <Field label="Social notes">
                <textarea
                  className="w-full h-[80px] p-2 rounded-xl border"
                  value={notesSoc}
                  onChange={(e) => setNotesSoc(e.target.value)}
                />
              </Field>

              <div className="col-span-2">
                <div className="text-sm text-slate-600 mb-1">Image(s) (optional)</div>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer">
                  Choose files
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={onPickFiles}
                  />
                </label>
                <span className="ml-3 text-sm text-slate-500">
                  {attachmentFiles.length
                    ? `${attachmentFiles.length} selected`
                    : "No file chosen"}
                </span>
              </div>

              <div className="col-span-2 flex items-center gap-2 mt-1">
                <button
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-60"
                  onClick={onSavePlan}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save plan"}
                </button>
                <button className="px-4 py-2 rounded-xl border" onClick={clearForm}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Session design picker (compact search) */}
        <div className="col-span-12 lg:col-span-6">
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Session design</h3>
              <div className="flex items-center gap-2">
                <button className="px-3 py-2 rounded-xl border" onClick={() => openDesigner()}>
                  New design
                </button>
                {linkedDesign && (
                  <button
                    className="px-3 py-2 rounded-xl border"
                    onClick={() => openDesigner(linkedDesign.id)}
                  >
                    Open in designer
                  </button>
                )}
              </div>
            </div>

            {/* Linked preview */}
            <div className="mb-3">
              {!linkedDesign ? (
                <div className="text-sm text-slate-500">No design linked to this plan.</div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl border">
                  <Thumb design={linkedDesign} />
                  <div className="flex-1">
                    <div className="font-medium">{linkedDesign.name}</div>
                    <div className="text-xs text-slate-500">
                      {linkedDesign.pitch || "—"}
                    </div>
                  </div>
                  <button
                    className="px-3 py-2 rounded-xl border"
                    onClick={() => setLinkedDesign(null)}
                  >
                    Unlink
                  </button>
                </div>
              )}
            </div>

            {/* Compact search + count */}
            <div className="mb-2 flex items-center gap-3">
              <input
                className="px-3 py-2 rounded-xl border w-[360px] max-w-full"
                placeholder="Search saved designs…"
                value={designSearch}
                onChange={(e) => setDesignSearch(e.target.value)}
              />
              <span className="text-sm text-slate-500">
                {loadingDesigns ? "Loading…" : `${filteredDesigns.length} found`}
              </span>
            </div>

            {/* Results */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredDesigns.map((d) => (
                <button
                  key={d.id}
                  className={`flex items-center gap-3 p-2 rounded-xl border text-left hover:bg-slate-50 ${
                    linkedDesign?.id === d.id ? "ring-2 ring-sky-400" : ""
                  }`}
                  onClick={() => setLinkedDesign(d)}
                  title={d._source === "local" ? "Local design" : "Cloud design"}
                >
                  <Thumb design={d} />
                  <div className="flex-1">
                    <div className="font-medium truncate">{d.name || "Untitled Session"}</div>
                    <div className="text-xs text-slate-500">
                      {(d.pitch || "—") + (d._source === "local" ? " • local" : "")}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {!filteredDesigns.length && !loadingDesigns && (
              <div className="text-sm text-slate-500 mt-3">
                No saved session designs yet.
              </div>
            )}

            <div className="text-xs text-slate-500 mt-3">
              Tip: Click a design above to <b>link</b> it to this plan. Use{" "}
              <b>New design</b> or <b>Open in designer</b> to edit in the full designer.
            </div>
          </div>
        </div>
      </div>

      {/* Repository */}
      <div className="mt-6 p-4 rounded-2xl border bg-white shadow-sm">
        <h3 className="font-semibold text-lg mb-3">Plan repository</h3>
        <div className="mb-3">
          <input
            className="px-3 py-2 rounded-xl border w-full"
            placeholder="Search by title, focus, topic…"
            value={repoSearch}
            onChange={(e) => setRepoSearch(e.target.value)}
          />
        </div>

        {loadingPlans ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-sm text-slate-500">No plans yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlans.map((p) => (
              <div key={p.id} className="p-3 rounded-2xl border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                    {p.design_thumb ? (
                      <img
                        alt=""
                        src={p.design_thumb}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-xs text-slate-500">No img</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-slate-500">
                      Focus: {p.focus || "—"} • Format: {p.format || "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg border">
                    Schedule this plan
                  </button>
                  <button className="px-3 py-1.5 rounded-lg border">Edit</button>
                  <button
                    className="px-3 py-1.5 rounded-lg border text-red-600"
                    onClick={async () => {
                      if (!confirm("Delete this plan?")) return;
                      await supabase.from("plans").delete().eq("id", p.id);
                      fetchPlans();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────── */
function Field({ label, children, span = 1 }) {
  // If Tailwind JIT doesn't catch dynamic col-span, replace with fixed classes if needed
  return (
    <div className={`col-span-${span}`}>
      <div className="text-sm text-slate-600 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Thumb({ design }) {
  if (design?.thumbnail_url) {
    return (
      <img
        src={design.thumbnail_url}
        alt=""
        className="w-12 h-12 rounded-lg object-cover bg-slate-100"
        draggable={false}
      />
    );
  }
  return <SvgPitchThumb pitch={design?.pitch || "full"} data={design?.data} />;
}

/* tiny pitch thumbnail */
function SvgPitchThumb({ pitch = "full", data }) {
  const { L, W } = layoutById(pitch);
  const scale = 0.12;
  const width = L * scale,
    height = W * scale;

  return (
    <svg
      className="w-12 h-12 rounded-lg bg-[#0b7d3b]"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <g transform={`scale(${scale})`}>
        <rect x="0" y="0" width={L} height={W} fill="#0b7d3b" />
        <g stroke="#fff" strokeWidth="0.5" fill="none" opacity="0.9">
          <rect x="0.5" y="0.5" width={L - 1} height={W - 1} />
          <line x1={L / 2} y1="0.5" x2={L / 2} y2={W - 0.5} />
          <circle cx={L / 2} cy={W / 2} r={Math.min(L, W) * 0.085} />
        </g>
        {Array.isArray(data?.items) &&
          data.items.slice(0, 4).map((it, i) => {
            const x = (it.x / 100) * L,
              y = (it.y / 100) * W;
            if (it.type === "player")
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={Math.min(L, W) * 0.02}
                  fill={it.color || "#f43"}
                />
              );
            if (it.type === "ball")
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={Math.min(L, W) * 0.012}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth="0.6"
                />
              );
            if (it.type?.startsWith("shape-"))
              return (
                <rect
                  key={i}
                  x={x - 4}
                  y={y - 4}
                  width="8"
                  height="8"
                  fill="#fff8"
                  stroke="#fff"
                  strokeWidth="0.5"
                />
              );
            return null;
          })}
      </g>
    </svg>
  );
}

function layoutById(id) {
  const LAYOUTS = {
    full: { L: 105, W: 68 },
    "9v9": { L: 73, W: 46 },
    "7v7": { L: 55, W: 37 },
    futsal: { L: 40, W: 20 },
    blank: { L: 60, W: 40 },
  };
  return LAYOUTS[id] || LAYOUTS.full;
}
