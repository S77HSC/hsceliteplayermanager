// src/components/SettingsTab.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function SettingsTab({ userId, onChange }) {
  const [form, setForm] = useState({
    brand_name: "",
    slogan: "",
    accent: "",
    logo_path: "",
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load the user's branding row (one row per user)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) return;
      const { data, error } = await supabase
        .from("branding")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(); // tolerant during migration; switch to .single() after unique constraint
      if (!mounted) return;
      if (error) {
        console.error(error);
        return;
      }
      if (data) {
        setForm({
          brand_name: data.brand_name || "",
          slogan: data.slogan || "",
          accent: data.accent || "",
          logo_path: data.logo_path || "",
        });
        onChange?.(data);
      }
    })();
    return () => { mounted = false; };
  }, [userId]);

  const logoUrl = form.logo_path
    ? supabase.storage.from("branding").getPublicUrl(form.logo_path).data.publicUrl
    : "";

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      let newLogoPath = form.logo_path || "";

      // Upload a new logo if chosen
      if (file) {
        const safeName = file.name?.replace(/[^a-zA-Z0-9_.-]/g, "_") || "logo.png";
        newLogoPath = `${userId}/logo-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase
          .storage.from("branding")
          .upload(newLogoPath, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
      }

      const payload = {
        user_id: userId,
        brand_name: form.brand_name || null,
        slogan: form.slogan || null,
        accent: form.accent || null,
        logo_path: newLogoPath || null,
      };

      // Upsert on user_id so each user has exactly one row
      const { data, error } = await supabase
        .from("branding")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;

      setForm((f) => ({ ...f, logo_path: newLogoPath }));
      onChange?.(data);
      alert("Branding saved.");
    } catch (e) {
      console.error(e);
      alert(`Couldn't save settings: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell card">
      <h2 className="section-title">Settings / Branding</h2>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        <input
          className="input"
          placeholder="Brand name"
          value={form.brand_name}
          onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Slogan"
          value={form.slogan}
          onChange={(e) => setForm((f) => ({ ...f, slogan: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Accent color (e.g. #0f172a)"
          value={form.accent}
          onChange={(e) => setForm((f) => ({ ...f, accent: e.target.value }))}
        />
        <div className="flex items-center gap-3">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="w-12 h-12 rounded-lg object-cover border" />
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <button className="btn-primary" onClick={save} disabled={saving || !userId}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Heads‑up: this expects a Supabase Storage bucket named <code>branding</code>. Update the
        bucket name in this file and in <code>App.jsx</code> if you rename it.
      </p>
    </div>
  );
}
