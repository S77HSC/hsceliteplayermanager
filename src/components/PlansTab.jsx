// src/components/PlansTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import PitchSVG from "./designer/PitchSVG";
import ItemGraphic from "./designer/ItemGraphic";

/* =========================
   CONFIG / CONSTANTS
   ========================= */
const BRAND = {
  // Fallbacks only; overridden by per-user branding row.
  name: "Club / Coach",
  logoUrl: "",
  slogan: "",
  accentColor: "",
  accent: "",
};

const A4W = 793.7; // px
const A4H = 1122.5; // px

const SYS_ALL = "__ALL__";
const SYS_UNFILED = "__UNFILED__";

/* =========================
   HELPERS
   ========================= */
function sanitizeFilename(name) {
  // allow letters, numbers, space, underscore, dot, hyphen
  return (name || "untitled").replace(/[^a-z0-9 _.\-]/gi, "_").slice(0, 64);
}

function buildTree(rows) {
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  rows.forEach((r) => {
    if (r.parent_id && byId.get(r.parent_id)) byId.get(r.parent_id).children.push(byId.get(r.id));
    else roots.push(byId.get(r.id));
  });
  return roots;
}

function parseMaybeJSON(v) {
  if (!v) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

function normalizePitch(p) {
  const allowed = new Set(["full", "half", "third", "blank"]);
  return allowed.has(p) ? p : "full";
}

async function fetchAsDataUrl(url) {
  if (!url) return "";
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function looksLikeHttp(u = "") { return /^https?:\/\//i.test(u); }
function looksLikeData(u = "") { return /^data:/i.test(u); }

/* Try common buckets for a storage path (best effort) */
async function supabasePathToPublicUrl(path) {
  const buckets = ["branding", "brand", "logos", "public"];
  for (const b of buckets) {
    try {
      const { data } = supabase.storage.from(b).getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    } catch {}
  }
  return "";
}

/* =========================
   MAIN COMPONENT
   ========================= */
export default function PlansTab() {
  /* ---------- auth ---------- */
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  /* ---------- per-user branding ---------- */
  const [brand, setBrand] = useState(BRAND);                // {name, slogan, logoUrl, accentColor, accent}
  const [brandLogoDataUrl, setBrandLogoDataUrl] = useState(""); // Data URL for reliable print/export

  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const { data: bRow } = await supabase
          .from("branding")
          .select("brand_name, accent_color, accent, slogan, logo_path, logodataurl, updated_at")
          .eq("user_id", userId)
          .maybeSingle();

        // start from existing localStorage fallback if any
        const localLogo = localStorage.getItem("epm_brand_logo_url") || "";

        let resolvedLogoUrl = "";   // a URL we can show in the UI
        let resolvedLogoData = "";  // a Data URL to guarantee print/export

        if (bRow?.logodataurl) {
          if (looksLikeData(bRow.logodataurl)) {
            resolvedLogoUrl = bRow.logodataurl;
            resolvedLogoData = bRow.logodataurl;
          } else if (looksLikeHttp(bRow.logodataurl)) {
            resolvedLogoUrl = bRow.logodataurl;
            resolvedLogoData = await fetchAsDataUrl(bRow.logodataurl);
          }
        }

        if (!resolvedLogoUrl && bRow?.logo_path) {
          if (looksLikeData(bRow.logo_path)) {
            resolvedLogoUrl = bRow.logo_path;
            resolvedLogoData = bRow.logo_path;
          } else if (looksLikeHttp(bRow.logo_path)) {
            resolvedLogoUrl = bRow.logo_path;
            resolvedLogoData = await fetchAsDataUrl(bRow.logo_path);
          } else {
            // looks like a storage path
            const pub = await supabasePathToPublicUrl(bRow.logo_path);
            if (pub) {
              resolvedLogoUrl = pub;
              resolvedLogoData = await fetchAsDataUrl(pub);
            }
          }
        }

        // last-resort fallbacks
        if (!resolvedLogoUrl && BRAND.logoUrl) {
          resolvedLogoUrl = BRAND.logoUrl;
          resolvedLogoData = await fetchAsDataUrl(BRAND.logoUrl);
        }
        if (!resolvedLogoUrl && localLogo) {
          resolvedLogoUrl = localLogo;
          resolvedLogoData = looksLikeData(localLogo) ? localLogo : await fetchAsDataUrl(localLogo);
        }

        setBrand({
          name: bRow?.brand_name || BRAND.name,
          slogan: bRow?.slogan || BRAND.slogan,
          accentColor: bRow?.accent_color || BRAND.accentColor,
          accent: bRow?.accent || BRAND.accent,
          logoUrl: resolvedLogoUrl,
        });
        setBrandLogoDataUrl(resolvedLogoData || "");
      } catch {
        // fallback if query fails
        const localLogo = localStorage.getItem("epm_brand_logo_url") || BRAND.logoUrl || "";
        setBrand((b) => ({ ...b, logoUrl: localLogo || b.logoUrl || "" }));
        setBrandLogoDataUrl(looksLikeData(localLogo) ? localLogo : await fetchAsDataUrl(localLogo));
      }
    })();
  }, [userId]);

  /* ---------- folders ---------- */
  const [folders, setFolders] = useState([]);
  async function fetchFolders() {
    try {
      let q = supabase.from("plan_folders").select("id,name,parent_id").order("name");
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      setFolders(data || []);
    } catch {
      setFolders([]);
    }
  }
  useEffect(() => { fetchFolders(); }, [userId]);

  async function createFolder(name, parent_id = null) {
    if (!name?.trim()) return;
    await supabase.from("plan_folders").insert({ user_id: userId, name: name.trim(), parent_id });
    fetchFolders();
  }
  async function renameFolder(id, name) {
    if (!name?.trim()) return;
    await supabase.from("plan_folders").update({ name: name.trim() }).eq("id", id);
    fetchFolders();
  }
  async function deleteFolder(id) {
    if (!confirm("Delete this folder?\n\nPlans in this folder will be set to Unfiled.")) return;
    await supabase.from("plan_folders").delete().eq("id", id);
    await supabase.from("plans").update({ folder_id: null }).eq("folder_id", id).eq("user_id", userId);
    fetchFolders(); fetchPlans();
  }

  /* ---------- create/edit form ---------- */
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState("");
  const [format, setFormat] = useState("General");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [defaultTime, setDefaultTime] = useState("");
  const [formFolderId, setFormFolderId] = useState(null);

  // four corners
  const [notesTech, setNotesTech] = useState("");
  const [notesPhys, setNotesPhys] = useState("");
  const [notesPsy, setNotesPsy] = useState("");
  const [notesSoc, setNotesSoc] = useState("");

  // design linking
  const [designs, setDesigns] = useState([]);
  const [designPickerOpen, setDesignPickerOpen] = useState(false);
  const [linkedDesign, setLinkedDesign] = useState(null);

  async function fetchDesigns() {
    try {
      let q = supabase
        .from("session_designs")
        .select("id,name,thumbnail_url,created_at")
        .order("created_at", { ascending: false });
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      setDesigns(data || []);
    } catch {
      setDesigns([]);
    }
  }
  useEffect(() => { fetchDesigns(); }, [userId]);

  function loadPlanIntoForm(p) {
    setEditingId(p.id);
    setTitle(p.title || "");
    setFocus(p.focus || "");
    setDescription(p.description || "");
    setTopics(p.topics || "");
    setFormat(p.format || "General");
    setDefaultLocation(p.defaultLocation || p.defaultlocation || "");
    setDefaultTime(p.defaultTime || p.defaulttime || "");
    setFormFolderId(p.folder_id || null);

    const fc = p.fourCorners || p.fourcorners || {};
    setNotesTech(fc.technical || "");
    setNotesPhys(fc.physical || "");
    setNotesPsy(fc.psychological || "");
    setNotesSoc(fc.social || "");

    if (p.design_id) {
      const d = designs.find((d) => d.id === p.design_id);
      setLinkedDesign(d || { id: p.design_id, name: p.design_name || "Linked design", thumbnail_url: p.design_thumb || null });
    } else {
      setLinkedDesign(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearForm() {
    setEditingId(null);
    setTitle(""); setFocus(""); setDescription(""); setTopics("");
    setFormat("General"); setDefaultLocation(""); setDefaultTime(""); setFormFolderId(null);
    setNotesTech(""); setNotesPhys(""); setNotesPsy(""); setNotesSoc("");
    setLinkedDesign(null);
  }

  /* ---------- plans repo ---------- */
  const [plans, setPlans] = useState([]);
  const [plansFilter, setPlansFilter] = useState("");
  const [plansError, setPlansError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(SYS_ALL);

  async function fetchPlans() {
    try {
      setPlansError(null);
      let q = supabase.from("plans").select("*").order("created_at", { ascending: false });
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      const normalized = (data || []).map((row) => ({
        ...row,
        defaultLocation: row.defaultlocation ?? row.defaultLocation ?? "",
        defaultTime: row.defaulttime ?? row.defaultTime ?? "",
        fourCorners: row.fourcorners ?? row.fourCorners ?? {},
      }));
      setPlans(normalized);
    } catch (e) {
      setPlans([]);
      setPlansError(e.message || String(e));
    }
  }
  useEffect(() => { fetchPlans(); }, [userId]);

  const filteredPlans = useMemo(() => {
    const q = (plansFilter || "").toLowerCase();
    return (plans || []).filter((p) => {
      if (selectedFolderId !== SYS_ALL) {
        if (selectedFolderId === SYS_UNFILED) {
          if (p.folder_id) return false;
        } else if (String(p.folder_id || "") !== String(selectedFolderId)) {
          return false;
        }
      }
      if (!q) return true;
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.focus || "").toLowerCase().includes(q) ||
        (p.topics || "").toLowerCase().includes(q)
      );
    });
  }, [plans, plansFilter, selectedFolderId]);

  /* ---------- save plan (handles unlink) ---------- */
  const [saving, setSaving] = useState(false);
  async function onSavePlan(e) {
    e?.preventDefault?.();
    if (!title.trim()) return alert("Give the plan a title.");
    setSaving(true);
    try {
      const payload = {
        user_id: userId || null,
        title: title.trim(),
        focus: focus.trim(),
        description: description.trim(),
        topics: topics.trim(),
        format,
        defaultlocation: defaultLocation.trim(),
        defaulttime: defaultTime.trim(),
        folder_id: formFolderId,
        fourcorners: { technical: notesTech, physical: notesPhys, psychological: notesPsy, social: notesSoc },
        design_id: linkedDesign?.id || null,
        design_thumb: linkedDesign?.thumbnail_url || null,
      };
      let error;
      if (editingId) ({ error } = await supabase.from("plans").update(payload).eq("id", editingId));
      else ({ error } = await supabase.from("plans").insert(payload));
      if (error) alert(`Save failed: ${error.message}`);
      else { clearForm(); fetchPlans(); }
    } catch (err) {
      alert(`Save failed: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  /* ---------- viewer ---------- */
  const [viewerPlanId, setViewerPlanId] = useState(null);
  const [viewer, setViewer] = useState({ plan: null, design: null, loading: false, error: null });

  async function openPlanViewer(planId) {
    setViewerPlanId(planId);
    setViewer({ plan: null, design: null, loading: true, error: null });

    const { data: plan, error: perr } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();

    if (perr || !plan) {
      setViewer({ plan: null, design: null, loading: false, error: perr?.message || "Plan not found" });
      return;
    }

    // Load linked design (preferred) / embedded / legacy local
    let design = null;

    if (plan.design_id) {
      const { data: drow } = await supabase
        .from("session_designs")
        .select("id,name,pitch,data,thumbnail_url")
        .eq("id", plan.design_id)
        .maybeSingle();

      const parsed = parseMaybeJSON(drow?.data);
      if (parsed && Array.isArray(parsed.items)) {
        design = {
          id: drow.id,
          name: drow.name || plan.design_name || "Session",
          pitch: normalizePitch(drow.pitch),
          data: parsed,
          thumbnail_url: drow.thumbnail_url || plan.design_thumb || null,
        };
      }
    } else if (plan.design_data) {
      const parsed = parseMaybeJSON(plan.design_data);
      if (parsed && Array.isArray(parsed.items)) {
        design = {
          id: plan.design_id,
          name: plan.design_name || "Session",
          pitch: normalizePitch(plan.design_pitch || "full"),
          data: parsed,
          thumbnail_url: plan.design_thumb || null,
        };
      }
    }

    if (!design && plan.design_id) {
      // Legacy local fallback
      try {
        const locals = JSON.parse(localStorage.getItem("epm_sessions_v1") || "[]");
        const row = locals.find((r) => r.id === plan.design_id);
        if (row) {
          design = {
            id: row.id,
            name: row.name || plan.design_name || "Session",
            pitch: normalizePitch(row.pitch || "full"),
            data: {
              items: row.items || [],
              keyframesById: row.keyframesById || {},
              timeline: row.timeline || 10,
              meta: { notes: row.notes || "", grid: row.grid ?? true },
            },
            thumbnail_url: row.thumbnail_url || row.thumb_dataurl || plan.design_thumb || null,
          };
        }
      } catch {}
    }

    setViewer({
      plan: {
        ...plan,
        defaultLocation: plan.defaultlocation ?? plan.defaultLocation ?? "",
        defaultTime: plan.defaulttime ?? plan.defaultTime ?? "",
        fourCorners: plan.fourcorners ?? plan.fourCorners ?? {},
      },
      design,
      loading: false,
      error: null,
    });
  }

  function closePlanViewer() {
    setViewerPlanId(null);
    setViewer({ plan: null, design: null, loading: false, error: null });
  }

  async function exportViewerA4(fmt = "png") {
    const node = document.getElementById("planA4Root");
    if (!node) return alert("Nothing to export.");
    try {
      const { toPng, toJpeg } = await import("html-to-image");
      const opts = { cacheBust: true, pixelRatio: 3, backgroundColor: "#ffffff", style: { transform: "none" }, width: A4W, height: A4H };
      const dataUrl = fmt === "jpeg" ? await toJpeg(node, { ...opts, quality: 0.95 }) : await toPng(node, opts);
      const a = document.createElement("a");
      a.href = dataUrl; a.download = `${sanitizeFilename(viewer.plan?.title)}_A4.${fmt}`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { alert(`Export failed: ${e?.message || e}`); }
  }

  async function printViewerA4() {
    const node = document.getElementById("planA4Root");
    if (!node) return alert("Nothing to print.");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 3, backgroundColor: "#ffffff", width: A4W, height: A4H });
      const w = window.open("", "_blank");
      if (!w) return alert("Pop-up blocked.");
      w.document.write(`<html><head><title>${viewer.plan?.title || "Plan"}</title></head><body style="margin:0"><img src="${dataUrl}" style="width:100%;height:auto"/></body></html>`);
      w.document.close(); w.focus();
    } catch (e) { alert(`Print failed: ${e?.message || e}`); }
  }

  // SAVE AS: duplicate current linked design into session_designs and (optionally) relink plan
  async function saveDesignAs() {
    const d = viewer.design;
    if (!d) return;
    const newName = prompt("Name for the new session design:", `${d.name || "Session"} Copy`);
    if (!newName) return;
    try {
      const payload = {
        user_id: userId || null,
        name: newName.trim(),
        pitch: d.pitch || "full",
        data: d.data ? JSON.stringify(d.data) : JSON.stringify({ items: [] }),
        thumbnail_url: d.thumbnail_url || null,
      };
      const { data: inserted, error } = await supabase.from("session_designs").insert(payload).select("id,thumbnail_url").single();
      if (error) throw error;

      if (viewer.plan?.id && confirm("Link this plan to the new copy?")) {
        await supabase
          .from("plans")
          .update({ design_id: inserted.id, design_thumb: inserted.thumbnail_url || d.thumbnail_url || null })
          .eq("id", viewer.plan.id);

        await openPlanViewer(viewer.plan.id);
        fetchPlans();
      }
      fetchDesigns();
      alert("Saved as new session design.");
    } catch (e) {
      alert(`Save As failed: ${e?.message || e}`);
    }
  }

  /* =========================
     UI
     ========================= */
  return (
    <div className="px-6 py-4 max-w-[1200px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT: create/edit */}
        <section className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-semibold mb-4">{editingId ? "Edit plan" : "Create plan"}</h2>

          <form onSubmit={onSavePlan} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Plan title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-3">
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Focus" value={focus} onChange={(e) => setFocus(e.target.value)} />
              <select className="w-full border rounded-lg px-3 py-2" value={format} onChange={(e) => setFormat(e.target.value)}>
                {["General", "3v3+2", "4v4", "5v5", "7v7", "9v9", "11v11"].map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
            </div>

            <div className="col-span-2">
              <textarea className="w-full border rounded-lg px-3 py-2 h-24" placeholder="Description / coaching points" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <input className="w-full border rounded-lg px-3 py-2" placeholder="Topics (comma separated)" value={topics} onChange={(e) => setTopics(e.target.value)} />
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Default location / pitch" value={defaultLocation} onChange={(e) => setDefaultLocation(e.target.value)} />
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Default time" value={defaultTime} onChange={(e) => setDefaultTime(e.target.value)} />

            <div className="col-span-2">
              <label className="text-sm text-slate-600 mb-1 block">Folder</label>
              <select className="w-full border rounded-lg px-3 py-2" value={formFolderId || ""} onChange={(e) => setFormFolderId(e.target.value || null)}>
                <option value="">— Unfiled —</option>
                {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
              </select>
            </div>

            {/* Linked design */}
            <div className="col-span-2">
              <label className="text-sm text-slate-600 mb-1 block">Linked design</label>
              {!linkedDesign ? (
                <button type="button" onClick={() => setDesignPickerOpen(true)} className="px-3 py-2 rounded-lg border hover:bg-neutral-50">
                  Link design…
                </button>
              ) : (
                <div className="flex items-center gap-3 p-2 border rounded-lg">
                  <div className="w-16 h-12 rounded-md overflow-hidden border bg-neutral-100 shrink-0">
                    {linkedDesign.thumbnail_url ? (
                      <img src={linkedDesign.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg viewBox="0 0 160 90" className="w-full h-full">
                        <rect width="160" height="90" fill="#0b7d3b" />
                        <line x1="80" y1="0" x2="80" y2="90" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
                        <circle cx="80" cy="45" r="12" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{linkedDesign.name || "Design"}</div>
                    <div className="text-xs text-slate-500 truncate">ID: {linkedDesign.id}</div>
                  </div>
                  <button type="button" onClick={() => setLinkedDesign(null)} className="px-3 py-1.5 rounded-lg border text-red-600">
                    Unlink
                  </button>
                </div>
              )}
            </div>

            {/* Four corners */}
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Technical</label>
                <textarea className="w-full border rounded-lg px-3 py-2 h-20" value={notesTech} onChange={(e) => setNotesTech(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Physical</label>
                <textarea className="w-full border rounded-lg px-3 py-2 h-20" value={notesPhys} onChange={(e) => setNotesPhys(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Psychological</label>
                <textarea className="w-full border rounded-lg px-3 py-2 h-20" value={notesPsy} onChange={(e) => setNotesPsy(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Social</label>
                <textarea className="w-full border rounded-lg px-3 py-2 h-20" value={notesSoc} onChange={(e) => setNotesSoc(e.target.value)} />
              </div>
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Save changes" : "Save plan"}
              </button>
              {editingId && (
                <button type="button" className="px-4 py-2 rounded-lg border" onClick={clearForm}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </section>

        {/* RIGHT: repository (compact tiles) */}
        <section className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Plan repository</h2>
            <input className="border rounded-lg px-3 py-2 w-72" placeholder="Search by title, focus, topic…" value={plansFilter} onChange={(e) => setPlansFilter(e.target.value)} />
          </div>

          <div className="flex gap-4">
            <FolderSidebar
              folders={folders}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onCreate={createFolder}
              onRename={renameFolder}
              onDelete={deleteFolder}
            />

            <div className="flex-1 min-w-0">
              {plansError && <div className="text-sm text-red-600 mb-2">Couldn’t load plans: {plansError}</div>}
              {filteredPlans.length === 0 ? (
                <div className="text-neutral-600 text-sm">No plans here.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredPlans.map((p) => (
                    <PlanTile key={p.id} plan={p} onOpen={() => openPlanViewer(p.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* VIEWER modal */}
      {viewerPlanId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[880px] max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold">{viewer.plan?.title || "Plan"} {viewer.loading ? "…" : ""}</div>
              <div className="flex items-center gap-2">
                {viewer.design && <button className="px-3 py-1.5 rounded-lg border" onClick={saveDesignAs}>Save As</button>}
                <button className="px-3 py-1.5 rounded-lg border" onClick={() => { if (!viewer.plan) return; loadPlanIntoForm(viewer.plan); closePlanViewer(); }}>Edit</button>
                <button className="px-3 py-1.5 rounded-lg border text-red-600" onClick={async () => {
                  if (!viewer.plan?.id) return;
                  if (!confirm("Delete this plan?")) return;
                  await supabase.from("plans").delete().eq("id", viewer.plan.id);
                  closePlanViewer();
                  fetchPlans();
                }}>Delete</button>
                <button className="px-3 py-1.5 rounded-lg border" onClick={() => exportViewerA4("png")}>Export A4 (PNG)</button>
                <button className="px-3 py-1.5 rounded-lg border" onClick={() => exportViewerA4("jpeg")}>Export A4 (JPEG)</button>
                <button className="px-3 py-1.5 rounded-lg border" onClick={printViewerA4}>Print</button>
                <button className="px-3 py-1.5 rounded-lg border" onClick={closePlanViewer}>Close</button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 grid place-items-center">
              {viewer.loading && <div>Loading…</div>}
              {viewer.error && <div className="text-red-600">{viewer.error}</div>}
              {!viewer.loading && !viewer.error && viewer.plan && (
                <A4Page plan={viewer.plan} design={viewer.design} brand={{ ...brand, logoDataUrl: brandLogoDataUrl }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* DESIGN PICKER modal */}
      {designPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[760px] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold">Link a design</div>
              <button className="px-3 py-1.5 rounded-lg border" onClick={() => setDesignPickerOpen(false)}>Close</button>
            </div>
            <div className="p-4 overflow-auto">
              {designs.length === 0 ? (
                <div className="text-sm text-slate-600">No designs found.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {designs.map((d) => (
                    <button
                      key={d.id}
                      className="w-full rounded-lg border hover:bg-neutral-50 text-left p-2"
                      onClick={() => {
                        setLinkedDesign({ id: d.id, name: d.name, thumbnail_url: d.thumbnail_url });
                        setDesignPickerOpen(false);
                      }}
                    >
                      <div className="w-full aspect-[4/3] rounded-md overflow-hidden border bg-neutral-100">
                        {d.thumbnail_url ? (
                          <img src={d.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 160 120" className="w-full h-full">
                            <rect width="160" height="120" fill="#0b7d3b" />
                            <line x1="80" y1="0" x2="80" y2="120" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
                            <circle cx="80" cy="60" r="14" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
                          </svg>
                        )}
                      </div>
                      <div
                        className="mt-2 text-xs font-medium leading-snug"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          wordBreak: "normal",
                          overflowWrap: "break-word",
                          hyphens: "none",
                        }}
                      >
                        {d.name || "Design"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   SIDEBAR
   ========================= */
function FolderSidebar({ folders, selectedId, onSelect, onCreate, onRename, onDelete }) {
  const tree = buildTree(folders);
  const Item = ({ active, children, onClick }) => (
    <div onClick={onClick} className={`px-2 py-1 rounded-md cursor-pointer ${active ? "bg-neutral-200" : "hover:bg-neutral-100"}`}>{children}</div>
  );
  function Node({ f, depth }) {
    return (
      <div className="mb-1" style={{ paddingLeft: 8 + depth * 12 }}>
        <div className="flex items-center justify-between">
          <Item active={String(selectedId) === String(f.id)} onClick={() => onSelect(f.id)}>
            <span className="truncate">{f.name}</span>
          </Item>
          <div className="flex items-center gap-1">
            <button className="text-xs px-2 py-0.5 rounded border" title="New subfolder" onClick={() => { const name = prompt("Folder name?"); if (name) onCreate(name, f.id); }}>+</button>
            <button className="text-xs px-2 py-0.5 rounded border" title="Rename" onClick={() => { const name = prompt("Rename folder", f.name); if (name) onRename(f.id, name); }}>R</button>
            <button className="text-xs px-2 py-0.5 rounded border text-red-600" title="Delete" onClick={() => onDelete(f.id)}>D</button>
          </div>
        </div>
        {f.children?.length > 0 && <div className="mt-1">{f.children.map((c) => (<Node key={c.id} f={c} depth={depth + 1} />))}</div>}
      </div>
    );
  }
  return (
    <div className="w-64 shrink-0 border rounded-lg p-2 h-[520px] overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Folders</div>
        <button className="text-xs px-2 py-0.5 rounded border" onClick={() => { const name = prompt("Folder name?"); if (name) onCreate(name, null); }}>+ New</button>
      </div>
      <div className="space-y-1 mb-2">
        <Item active={selectedId === SYS_ALL} onClick={() => onSelect(SYS_ALL)}>All</Item>
        <Item active={selectedId === SYS_UNFILED} onClick={() => onSelect(SYS_UNFILED)}>Unfiled</Item>
      </div>
      {tree.map((f) => (<Node key={f.id} f={f} depth={0} />))}
    </div>
  );
}

/* =========================
   PLAN TILE
   ========================= */
function PlanTile({ plan, onOpen }) {
  const thumb = plan.design_thumb;
  return (
    <button onClick={onOpen} className="w-full rounded-lg border hover:bg-neutral-50 text-left p-2" aria-label={`Open ${plan.title || "Plan"}`}>
      <div className="w-full aspect-[4/3] rounded-md overflow-hidden border bg-neutral-100">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg viewBox="0 0 160 120" className="w-full h-full">
            <rect width="160" height="120" fill="#0b7d3b" />
            <line x1="80" y1="0" x2="80" y2="120" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
            <circle cx="80" cy="60" r="14" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
          </svg>
        )}
      </div>
      <div
        className="mt-2 text-xs font-medium leading-snug"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "normal",
          overflowWrap: "break-word",
          hyphens: "none",
        }}
      >
        {plan.title || "Untitled plan"}
      </div>
    </button>
  );
}

/* =========================
   A4 VIEWER PAGE
   ========================= */
function A4Page({ plan, design, brand }) {
  const innerPad = 18;
  const contentW = A4W - innerPad * 2;
  const stageW = contentW;
  const stageH = (stageW * 9) / 16;
  const pitchId = normalizePitch(design?.pitch || "full");

  const items = design?.data?.items || [];
  const imgFallback = design?.thumbnail_url || "";

  // Prefer preloaded data URL for export/print reliability
  const logoSrc = plan.brand_logo_url || brand.logoDataUrl || brand.logoUrl || "";

  return (
    <div id="planA4Root" className="bg-white" style={{ width: A4W, height: A4H }}>
      {/* Hidden marker defs so arrowheads render everywhere (aliases + context-stroke) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          {/* generic triangle that inherits the stroke color of the line using it */}
          <marker id="arrowhead" viewBox="0 0 10 10"
                  refX="9" refY="5" markerWidth="6" markerHeight="6"
                  orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
          </marker>

          {/* common aliases some items may use */}
          <marker id="arrow" viewBox="0 0 10 10"
                  refX="9" refY="5" markerWidth="6" markerHeight="6"
                  orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
          </marker>

          <marker id="endArrow" viewBox="0 0 10 10"
                  refX="9" refY="5" markerWidth="6" markerHeight="6"
                  orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
          </marker>

          <marker id="markerArrow" viewBox="0 0 10 10"
                  refX="9" refY="5" markerWidth="6" markerHeight="6"
                  orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10 Z" fill="context-stroke" />
          </marker>

          {/* explicit color fallbacks if anything hard-codes these ids */}
          <marker id="arrowhead-white" viewBox="0 0 10 10"
                  refX="9" refY="5" markerWidth="6" markerHeight="6"
                  orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10 Z" fill="#ffffff" />
          </marker>

          <marker id="arrowhead-black" viewBox="0 0 10 10"
                  refX="9" refY="5" markerWidth="6" markerHeight="6"
                  orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10 Z" fill="#0b0f19" />
          </marker>
        </defs>
      </svg>

      <div className="p-[18px] flex flex-col h-full">
        {/* header */}
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">{plan.title || "Session"}</div>
              <div className="text-xs text-slate-500">
                {plan.defaultLocation || ""} {plan.defaultTime ? `• ${plan.defaultTime}` : ""}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              {logoSrc ? (
                <img src={logoSrc} crossOrigin="anonymous" alt="logo" className="w-10 h-10 rounded-md border object-contain bg-white" />
              ) : (
                <div className="w-10 h-10 rounded-md border grid place-items-center text-xs text-slate-500">LOGO</div>
              )}
              <div>{brand?.name || BRAND.name}</div>
              {brand?.slogan && <div className="text-[10px] text-slate-500">{brand.slogan}</div>}
            </div>
          </div>
        </div>

        {/* stage */}
        <div className="rounded-xl border overflow-hidden mb-3" style={{ width: contentW, height: stageH, background: "#0b7d3b" }}>
          {items.length ? (
            <div className="relative" style={{ width: stageW, height: stageH, margin: "0 auto" }}>
              <PitchSVG pitchId={pitchId} showGrid={false} />
              {items.map((it) => (
                <div
                  key={it.id}
                  className="absolute select-none"
                  style={{
                    left: `${it.x}%`,
                    top: `${it.y}%`,
                    transform: `translate(-50%,-50%) rotate(${it.rot || 0}deg)`,
                    overflow: "visible",
                  }}
                >
                  <ItemGraphic item={it} stageWidth={stageW} />
                </div>
              ))}
            </div>
          ) : (
            <img src={imgFallback || ""} alt="design" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
        </div>

        {/* meta */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="font-semibold mb-1">Overview</div>
            <div className="text-xs leading-6">
              <div><span className="text-slate-500">Focus:</span> {plan.focus || "—"}</div>
              <div><span className="text-slate-500">Format:</span> {plan.format || "—"}</div>
              <div><span className="text-slate-500">Topics:</span> {plan.topics || "—"}</div>
              <div><span className="text-slate-500">Location:</span> {plan.defaultLocation || "—"}</div>
              <div><span className="text-slate-500">Time:</span> {plan.defaultTime || "—"}</div>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-1">Description</div>
            <div className="text-xs whitespace-pre-wrap min-h-[60px]">{plan.description || "—"}</div>
          </div>
        </div>

        {/* four corners */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Corner title="Technical" text={plan.fourCorners?.technical} />
          <Corner title="Physical" text={plan.fourCorners?.physical} />
          <Corner title="Psychological" text={plan.fourCorners?.psychological} />
          <Corner title="Social" text={plan.fourCorners?.social} />
        </div>

        {/* footer */}
        <div className="mt-auto pt-3 text-[10px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logoSrc ? (
              <img src={logoSrc} crossOrigin="anonymous" alt="logo" className="w-10 h-10 rounded-md border object-contain bg-white" />
            ) : (
              <div className="w-10 h-10 rounded-md border grid place-items-center text-xs text-slate-500">LOGO</div>
            )}
          </div>
          <div className="text-right">
            <div className="font-bold text-base">{brand?.name || BRAND.name}</div>
            {brand?.slogan && <div className="text-xs text-slate-500">{brand.slogan}</div>}
            {brand?.accentColor && <div className="text-[9px] text-slate-400">Accent: {brand.accentColor}</div>}
          </div>
          <div className="text-xs text-slate-500">{new Date(plan.created_at || Date.now()).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}

function Corner({ title, text, fullWidth }) {
  return (
    <div className={`${fullWidth ? "col-span-2" : ""} border rounded-lg p-2`}>
      <div className="text-xs font-semibold mb-1">{title}</div>
      <div className="text-xs whitespace-pre-wrap min-h-[56px]">{text || "—"}</div>
    </div>
  );
}
