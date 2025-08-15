import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("Plans");

  // Players state
  const [playerName, setPlayerName] = useState("");
  const [classGroup, setClassGroup] = useState("U12");
  const [position, setPosition] = useState("Forward");
  const [players, setPlayers] = useState([]);

  // Plans state
  const [plans, setPlans] = useState([]);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [planForm, setPlanForm] = useState({
    title: "",
    focus: "",
    description: "",
    topics: "",
    format: "U12",
    defaultLocation: "",
    defaultTime: "",
    fourCorners: {
      technical: "",
      physical: "",
      psychological: "",
      social: ""
    },
    attachments: []
  });

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Fetch data after login
  useEffect(() => {
    if (session?.user) {
      fetchPlayers();
      fetchPlans();
    }
  }, [session]);

  // Fetch Players
  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setPlayers(data);
  };

  // Fetch Plans
  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setPlans(data);
  };

  // Upload a file to Supabase Storage
  const uploadFile = async (file) => {
    if (!file) return null;
    try {
      const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("plans").upload(filePath, file);
      if (error) throw error;
      const { data } = supabase.storage.from("plans").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error("File upload error:", err);
      return null;
    }
  };

  // Save (Insert/Update) Plan
  const savePlan = async (e) => {
    e.preventDefault();
    if (!planForm.title) return alert("Plan title required");

    const urls = [];
    if (file1) {
      const url1 = await uploadFile(file1);
      if (url1) urls.push(url1);
    }
    if (file2) {
      const url2 = await uploadFile(file2);
      if (url2) urls.push(url2);
    }

    const planData = {
      ...planForm,
      attachments: urls.length ? urls : planForm.attachments,
      user_id: session.user.id
    };

    let error;
    if (editingPlanId) {
      ({ error } = await supabase.from("plans").update(planData).eq("id", editingPlanId));
    } else {
      ({ error } = await supabase.from("plans").insert([planData]));
    }

    if (error) {
      console.error("Error saving plan:", error);
      alert(JSON.stringify(error));
    } else {
      resetPlanForm();
      fetchPlans();
    }
  };

  const editPlan = (plan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      title: plan.title || "",
      focus: plan.focus || "",
      description: plan.description || "",
      topics: plan.topics || "",
      format: plan.format || "U12",
      defaultLocation: plan.defaultLocation || "",
      defaultTime: plan.defaultTime || "",
      fourCorners: plan.fourCorners || {
        technical: "",
        physical: "",
        psychological: "",
        social: ""
      },
      attachments: plan.attachments || []
    });
    setFile1(null);
    setFile2(null);
  };

  const resetPlanForm = () => {
    setEditingPlanId(null);
    setFile1(null);
    setFile2(null);
    setPlanForm({
      title: "",
      focus: "",
      description: "",
      topics: "",
      format: "U12",
      defaultLocation: "",
      defaultTime: "",
      fourCorners: {
        technical: "",
        physical: "",
        psychological: "",
        social: ""
      },
      attachments: []
    });
  };

  const deletePlan = async (id) => {
    if (!window.confirm("Delete this plan?")) return;
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (!error) fetchPlans();
  };

  // Add Player
  const addPlayer = async () => {
    if (!playerName || !classGroup || !position) {
      alert("Please fill in all fields");
      return;
    }
    const { error } = await supabase
      .from("players")
      .insert([{ user_id: session.user.id, name: playerName, classGroup, position }]);
    if (!error) {
      setPlayerName("");
      setClassGroup("U12");
      setPosition("Forward");
      fetchPlayers();
    }
  };

  const deletePlayer = async (id) => {
    if (!window.confirm("Delete this player?")) return;
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (!error) fetchPlayers();
  };

  // Auth
  const signInWithEmail = async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };
  const signOut = async () => supabase.auth.signOut();

  if (!session) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 w-[400px]">
          <h1 className="text-xl font-semibold mb-6 text-center">Help Soccer Coach</h1>
          <button
            onClick={signInWithEmail}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Tabs */}
      <div className="flex justify-between items-center p-4 bg-white shadow">
        <div className="flex gap-2">
          {["Plans", "Sessions", "Players", "Attendance"].map((tabName) => (
            <button
              key={tabName}
              className={`px-5 py-2 rounded-lg ${
                tab === tabName ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
              onClick={() => setTab(tabName)}
            >
              {tabName}
            </button>
          ))}
        </div>
        <button onClick={signOut} className="bg-red-500 text-white px-4 py-2 rounded-lg">
          Sign out
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 grid grid-cols-2 gap-6 max-h-[calc(100vh-80px)]">
        {/* Plans Tab */}
        {tab === "Plans" && (
          <>
            {/* Plan Form */}
            <div className="bg-white rounded-lg shadow p-6 overflow-auto">
              <h2 className="text-lg font-semibold mb-4">
                {editingPlanId ? "Edit plan" : "Create plan"}
              </h2>
              <form onSubmit={savePlan} className="space-y-3">
                <input
                  className="w-full border p-2 rounded"
                  placeholder="Title"
                  value={planForm.title}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                />
                <input
                  className="w-full border p-2 rounded"
                  placeholder="Focus"
                  value={planForm.focus}
                  onChange={(e) => setPlanForm({ ...planForm, focus: e.target.value })}
                />
                <textarea
                  className="w-full border p-2 rounded"
                  placeholder="Description"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                />
                <input
                  className="w-full border p-2 rounded"
                  placeholder="Topics"
                  value={planForm.topics}
                  onChange={(e) => setPlanForm({ ...planForm, topics: e.target.value })}
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="border p-2 rounded"
                    value={planForm.format}
                    onChange={(e) => setPlanForm({ ...planForm, format: e.target.value })}
                  >
                    <option>U12</option>
                    <option>U14</option>
                    <option>U16</option>
                  </select>
                  <input
                    className="border p-2 rounded"
                    placeholder="Location"
                    value={planForm.defaultLocation}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, defaultLocation: e.target.value })
                    }
                  />
                  <input
                    type="time"
                    className="border p-2 rounded"
                    value={planForm.defaultTime}
                    onChange={(e) => setPlanForm({ ...planForm, defaultTime: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["technical", "physical", "psychological", "social"].map((corner) => (
                    <textarea
                      key={corner}
                      className="border p-2 rounded text-sm"
                      placeholder={corner.charAt(0).toUpperCase() + corner.slice(1)}
                      value={planForm.fourCorners[corner]}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          fourCorners: {
                            ...planForm.fourCorners,
                            [corner]: e.target.value
                          }
                        })
                      }
                    />
                  ))}
                </div>
                <input type="file" onChange={(e) => setFile1(e.target.files[0])} />
                <input type="file" onChange={(e) => setFile2(e.target.files[0])} />
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded flex-1">
                    {editingPlanId ? "Update" : "Save"}
                  </button>
                  {editingPlanId && (
                    <button
                      type="button"
                      onClick={resetPlanForm}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded flex-1"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Plans List */}
            <div className="bg-white rounded-lg shadow p-6 overflow-auto">
              <h2 className="text-lg font-semibold mb-4">Plans list</h2>
              <div className="grid gap-4">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="border rounded-lg p-4 shadow-sm bg-white h-[400px] flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="font-semibold text-lg">{p.title}</h3>
                      <p className="text-sm text-gray-600">Focus: {p.focus}</p>
                      <p className="mt-1 text-sm">{p.description}</p>

                      {/* Four Corners */}
                      {p.fourCorners && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className="bg-blue-100 p-2 rounded">
                            <strong>Technical</strong>
                            <div className="text-xs">{p.fourCorners.technical}</div>
                          </div>
                          <div className="bg-green-100 p-2 rounded">
                            <strong>Physical</strong>
                            <div className="text-xs">{p.fourCorners.physical}</div>
                          </div>
                          <div className="bg-yellow-100 p-2 rounded">
                            <strong>Psychological</strong>
                            <div className="text-xs">{p.fourCorners.psychological}</div>
                          </div>
                          <div className="bg-purple-100 p-2 rounded">
                            <strong>Social</strong>
                            <div className="text-xs">{p.fourCorners.social}</div>
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {p.attachments && p.attachments.length > 0 && (
                        <div className="mt-2 flex gap-2">
                          {p.attachments.map((url, i) => {
                            const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                            return isImage ? (
                              <img
                                key={i}
                                src={url}
                                alt={`Attachment ${i + 1}`}
                                className="h-16 w-16 object-cover rounded"
                              />
                            ) : (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 underline text-xs"
                              >
                                File {i + 1}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => editPlan(p)}
                        className="text-blue-600 underline text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePlan(p.id)}
                        className="text-red-600 underline text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Players Tab */}
        {tab === "Players" && (
          <>
            <div className="bg-white rounded-lg shadow p-6 overflow-auto">
              <h2 className="text-lg font-semibold mb-4">Add Player</h2>
              <input
                className="w-full border p-2 mb-3 rounded"
                placeholder="Player Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
              <select
                className="w-full border p-2 mb-3 rounded"
                value={classGroup}
                onChange={(e) => setClassGroup(e.target.value)}
              >
                <option>U12</option>
                <option>U14</option>
                <option>U16</option>
              </select>
              <select
                className="w-full border p-2 mb-3 rounded"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option>Forward</option>
                <option>Midfield</option>
                <option>Defense</option>
                <option>Goalkeeper</option>
              </select>
              <button
                onClick={addPlayer}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
              >
                Save Player
              </button>
            </div>
            <div className="bg-white rounded-lg shadow p-6 overflow-auto">
              <h2 className="text-lg font-semibold mb-4">Players list</h2>
              <div className="grid gap-3">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="border rounded-lg p-4 shadow-sm flex justify-between items-center"
                  >
                    <div>
                      <strong>{p.name}</strong> - {p.classGroup} - {p.position}
                    </div>
                    <button
                      onClick={() => deletePlayer(p.id)}
                      className="text-red-600 underline text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Sessions Tab */}
        {tab === "Sessions" && (
          <div className="col-span-2 bg-white rounded-lg shadow p-6 flex items-center justify-center">
            <p className="text-gray-500">Sessions management coming soon...</p>
          </div>
        )}

        {/* Attendance Tab */}
        {tab === "Attendance" && (
          <div className="col-span-2 bg-white rounded-lg shadow p-6 flex items-center justify-center">
            <p className="text-gray-500">Attendance tracking coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
