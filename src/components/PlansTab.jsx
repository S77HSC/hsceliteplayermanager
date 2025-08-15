import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function PlansTab({
  userId,
  plans = [],
  fetchPlans,
  onSchedulePlan, // App passes this to jump to Sessions + prefill
}) {
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [planForm, setPlanForm] = useState({
    title: "",
    focus: "",
    description: "",
    topics: "",
    format: "",
    defaultLocation: "",
    defaultTime: "",
    fourCorners: { technical: "", physical: "", psychological: "", social: "" },
    attachments: [],
  });
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState({});
  const [confirmPlan, setConfirmPlan] = useState(null); // for delete confirm

  const publicUrl = (path) =>
    supabase.storage.from("plans").getPublicUrl(path).data.publicUrl;

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function editPlan(plan) {
    setEditingPlanId(plan.id);
    setPlanForm({
      title: plan.title || "",
      focus: plan.focus || "",
      description: plan.description || "",
      topics: plan.topics || "",
      format: plan.format || "",
      defaultLocation: plan.defaultLocation || "",
      defaultTime: plan.defaultTime || "",
      fourCorners:
        plan.fourCorners || {
          technical: "",
          physical: "",
          psychological: "",
          social: "",
        },
      attachments: [],
    });
  }

  async function uploadFile(file, planId) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${planId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("plans")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
        cacheControl: "3600",
      });
    if (error) throw error;
    return path;
  }

  async function savePlan() {
    const id = editingPlanId || crypto.randomUUID();

    const uploadedPaths = [];
    for (const file of planForm.attachments) {
      // eslint-disable-next-line no-await-in-loop
      const path = await uploadFile(file, id);
      uploadedPaths.push(path);
    }

    const payload = {
      id,
      user_id: userId,
      title: planForm.title.trim(),
      focus: planForm.focus.trim(),
      description: planForm.description.trim(),
      topics: planForm.topics.trim(),
      format: planForm.format.trim(),
      defaultLocation: planForm.defaultLocation.trim(),
      defaultTime: planForm.defaultTime.trim(),
      fourCorners: planForm.fourCorners,
      attachmentPaths: uploadedPaths,
    };

    if (editingPlanId) {
      const existing = plans.find((p) => p.id === editingPlanId);
      const merged = {
        ...payload,
        attachmentPaths: [
          ...(existing?.attachmentPaths || existing?.attachmentpaths || []),
          ...(payload.attachmentPaths || []),
        ],
      };
      await supabase.from("plans").update(merged).eq("id", editingPlanId);
    } else {
      await supabase.from("plans").insert([payload]);
    }

    setEditingPlanId(null);
    setPlanForm({
      title: "",
      focus: "",
      description: "",
      topics: "",
      format: "",
      defaultLocation: "",
      defaultTime: "",
      fourCorners: { technical: "", physical: "", psychological: "", social: "" },
      attachments: [],
    });

    fetchPlans && fetchPlans();
  }

  async function reallyDeletePlan(id) {
    await supabase.from("plans").delete().eq("id", id);
    setConfirmPlan(null);
    fetchPlans && fetchPlans();
  }

  const filteredPlans = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((p) => {
      const hay = [
        p.title,
        p.focus,
        p.description,
        p.topics,
        p.format,
        p.defaultLocation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [plans, q]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 app-shell">
      {/* Create / Edit */}
      <div className="card">
        <h2 className="section-title">
          {editingPlanId ? "Edit plan (repository)" : "Create plan (repository)"}
        </h2>

        <input
          className="input mb-3"
          placeholder="Plan title"
          value={planForm.title}
          onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
        />
        <input
          className="input mb-3"
          placeholder="Focus (e.g., Turning, Pressing, GK Handling)"
          value={planForm.focus}
          onChange={(e) => setPlanForm({ ...planForm, focus: e.target.value })}
        />
        <textarea
          className="textarea mb-3"
          placeholder="Description / coaching points"
          value={planForm.description}
          onChange={(e) =>
            setPlanForm({ ...planForm, description: e.target.value })
          }
        />
        <input
          className="input mb-3"
          placeholder="Topics (comma separated)"
          value={planForm.topics}
          onChange={(e) => setPlanForm({ ...planForm, topics: e.target.value })}
        />

        <div className="grid grid-cols-3 gap-3 mb-3">
          <select
            className="select"
            value={planForm.format}
            onChange={(e) => setPlanForm({ ...planForm, format: e.target.value })}
          >
            <option value="">Format</option>
            <option>8-2-1</option>
            <option>7-2-1</option>
            <option>6-3-1</option>
            <option>Other</option>
          </select>
          <input
            className="input"
            placeholder="Default location"
            value={planForm.defaultLocation}
            onChange={(e) =>
              setPlanForm({ ...planForm, defaultLocation: e.target.value })
            }
          />
          <input
            className="input"
            placeholder="Default time"
            value={planForm.defaultTime}
            onChange={(e) =>
              setPlanForm({ ...planForm, defaultTime: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          {["technical", "physical", "psychological", "social"].map((corner) => (
            <input
              key={corner}
              className="input"
              placeholder={`${corner} notes`}
              value={planForm.fourCorners[corner] || ""}
              onChange={(e) =>
                setPlanForm({
                  ...planForm,
                  fourCorners: {
                    ...planForm.fourCorners,
                    [corner]: e.target.value,
                  },
                })
              }
            />
          ))}
        </div>

        <label className="block text-sm text-slate-600 mb-1">Image (optional)</label>
        <input
          type="file"
          multiple
          onChange={(e) =>
            setPlanForm({ ...planForm, attachments: Array.from(e.target.files) })
          }
          className="mb-4"
        />

        <div className="flex gap-2">
          <button className="btn-primary w-full" onClick={savePlan}>
            {editingPlanId ? "Update plan" : "Create plan"}
          </button>
          {editingPlanId && (
            <button
              className="btn-ghost"
              onClick={() => {
                setEditingPlanId(null);
                setPlanForm({
                  title: "",
                  focus: "",
                  description: "",
                  topics: "",
                  format: "",
                  defaultLocation: "",
                  defaultTime: "",
                  fourCorners: {
                    technical: "",
                    physical: "",
                    psychological: "",
                    social: "",
                  },
                  attachments: [],
                });
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Repository */}
      <div className="card">
        <h2 className="section-title">Plan repository</h2>

        <input
          className="input mb-4"
          placeholder="Search by title, focus, topic…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {/* Compact tile grid */}
        <div className="plan-grid">
          {filteredPlans.map((p) => {
            const paths =
              p.attachmentPaths || p.attachmentpaths || p.attachments || [];
            const firstPath = Array.isArray(paths) ? paths[0] : null;
            const imgUrl = firstPath ? publicUrl(firstPath) : null;
            const isOpen = !!expanded[p.id];

            return (
              <div key={p.id} className="plan-card">
                <div style={{ display: "flex", gap: "10px" }}>
                  {imgUrl && (
                    <img
                      src={imgUrl}
                      alt="plan"
                      loading="lazy"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                      style={{
                        width: 44,
                        height: 44,
                        objectFit: "cover",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 className="plan-title">{p.title || "Untitled plan"}</h4>
                    <div className="plan-meta">
                      <div>Focus: {p.focus || "—"}</div>
                      <div>
                        Format: {p.format || "—"}
                        {p.defaultTime ? ` · Default: ${p.defaultTime}` : ""}
                      </div>
                      {p.topics ? (
                        <div className={isOpen ? "" : "clamp-2"}>Topics: {p.topics}</div>
                      ) : null}
                    </div>

                    <div className="plan-actions">
                      <button
                        className="btn btn-primary btn-chip"
                        onClick={() =>
                          onSchedulePlan
                            ? onSchedulePlan(p)
                            : console.warn("onSchedulePlan not provided")
                        }
                      >
                        Schedule this plan
                      </button>
                      <button className="btn btn-outline btn-chip" onClick={() => editPlan(p)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-chip"
                        onClick={() => setConfirmPlan(p)}
                      >
                        Delete
                      </button>
                      {p.topics && (
                        <button
                          className="btn btn-outline btn-chip"
                          onClick={() => toggleExpand(p.id)}
                        >
                          {isOpen ? "Less" : "More"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredPlans.length === 0 && (
            <div className="text-sm text-slate-500">No plans found.</div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmPlan && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h4 className="modal-title">Delete this plan?</h4>
            <p>
              <strong>{confirmPlan.title || "Untitled plan"}</strong>
            </p>
            <p className="plan-meta" style={{ marginTop: 6 }}>
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmPlan(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => reallyDeletePlan(confirmPlan.id)}
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
