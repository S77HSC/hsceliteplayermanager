// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

// Core tabs you already have
import PlansTab from "./components/PlansTab";
import SessionsTab from "./components/SessionsTab";
import PlayersTab from "./components/PlayersTab";

// Optional extra tabs (leave imports if you have them; or comment out + remove from TABS below)
import ParentReportTab from "./components/ParentReportTab";
import GradingTab from "./components/GradingTab";
import SettingsTab from "./components/SettingsTab";

/* ---------- Simple sign-in panel (inline, no extra file) ---------- */
function SignInCard() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) setMsg(error.message);
  }

  async function signUp() {
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password: pass });
    if (error) setMsg(error.message);
    else setMsg("Account created. You can sign in now.");
  }

  return (
    <div className="app-shell">
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 className="section-title">Elite Player Manager</h1>
        <p className="text-sm text-slate-600 mb-3">
          Please sign in to access your dashboard.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {msg && <p className="text-sm text-red-600 mt-2">{msg}</p>}

        <div className="flex gap-2 mt-3">
          <button className="btn-primary" onClick={signIn}>
            Sign in
          </button>
          <button className="btn btn-outline" onClick={signUp}>
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  /* ---------------- Auth ---------------- */
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.session?.user?.id || null);
      setUserEmail(data.session?.user?.email || "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id || null);
      setUserEmail(session?.user?.email || "");
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  /* ---------------- Branding ---------------- */
  const [branding, setBranding] = useState(null);

  // Load branding for this user (one row per user)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from("branding")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!error) setBranding(data || null);
    })();
  }, [userId]);

  const accent = branding?.accent || "#0f172a";
  const logoUrl = branding?.logo_path
    ? supabase.storage.from("branding").getPublicUrl(branding.logo_path).data.publicUrl
    : null;

  /* ---------------- Tabs ---------------- */
  const TABS = useMemo(
    () => [
      { key: "plans", label: "Plans" },
      { key: "sessions", label: "Sessions" },
      { key: "players", label: "Players" },
      { key: "grading", label: "Grading" },
      { key: "reports", label: "Reports" },
      { key: "settings", label: "Settings" },
    ],
    []
  );
  const [active, setActive] = useState("plans");

  /* ---------------- Data ---------------- */
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [gradeRules, setGradeRules] = useState([]);
  const [gradings, setGradings] = useState([]);

  async function fetchPlans() {
    if (!userId) return;
    const { data } = await supabase
      .from("plans")
      .select("*")
      .eq("user_id", userId)
      .order("title");
    setPlans(data || []);
  }
  async function fetchSessions() {
    if (!userId) return;
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    setSessions(data || []);
  }
  async function fetchPlayers() {
    if (!userId) return;
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    setPlayers(data || []);
  }
  async function fetchGradeRules() {
    if (!userId) return;
    const { data } = await supabase
      .from("grading_rules")
      .select("*")
      .eq("user_id", userId)
      .order("area")
      .order("target_belt");
    setGradeRules(data || []);
  }
  async function fetchGradings() {
    if (!userId) return;
    const { data } = await supabase
      .from("player_gradings")
      .select("*")
      .eq("user_id", userId)
      .order("scheduled_date", { ascending: true });
    setGradings(data || []);
  }

  // Fetch when logged in
  useEffect(() => {
    if (!userId) return;
    fetchPlans();
    fetchSessions();
    fetchPlayers();
    fetchGradeRules();
    fetchGradings();
  }, [userId]);

  /* ---- “Schedule this plan” → prefill Sessions ---- */
  const [prefillFromPlan, setPrefillFromPlan] = useState(null);
  function handleSchedulePlan(plan) {
    setPrefillFromPlan({
      planid: plan.id,
      type: plan.title || "Training",
      location: plan.defaultLocation || "",
      time: plan.defaultTime || "",
    });
    setActive("sessions");
  }

  /* ---------------- Gate: show sign-in until authenticated ---------------- */
  if (!userId) return <SignInCard />;

  /* ---------------- Dashboard ---------------- */
  return (
    <div className="min-h-screen">
      <header className="app-shell">
        <div className="flex items-center justify-between gap-3 mb-3">
          {/* Title + brand badge */}
          <div className="flex items-center gap-3">
            <div className="text-xl font-semibold">Elite Player Manager</div>
            {branding && (
              <span
                className="inline-flex items-center gap-2 px-2 py-1 rounded-full border text-sm"
                style={{ borderColor: accent }}
                title={branding.slogan || branding.brand_name}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" className="w-5 h-5 rounded" />
                ) : null}
                <span className="font-medium" style={{ color: accent }}>
                  {branding.brand_name || "Brand"}
                </span>
                {branding.slogan ? (
                  <span className="text-xs text-slate-500">— {branding.slogan}</span>
                ) : null}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {userEmail && (
              <span className="text-sm text-slate-600 hidden md:inline">
                {userEmail}
              </span>
            )}
            <button className="btn btn-outline" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {/* Tabs (flush-left; .tab-active for current) */}
        <nav className="top-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${active === t.key ? "tab-active" : ""}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {/* Slim accent bar under header */}
        <div style={{ background: accent, height: 2 }} />
      </header>

      <main className="mt-4">
        {active === "plans" && (
          <PlansTab
            userId={userId}
            plans={plans}
            fetchPlans={fetchPlans}
            onScheduleRequest={handleSchedulePlan}
          />
        )}

        {active === "sessions" && (
          <SessionsTab
            userId={userId}
            players={players}
            plans={plans}
            sessions={sessions}
            fetchSessions={async () => {
              await fetchSessions();
              fetchPlans();
              fetchPlayers();
            }}
            prefillFromPlan={prefillFromPlan}
            onPrefillConsumed={() => setPrefillFromPlan(null)}
          />
        )}

        {active === "players" && (
          <PlayersTab
            userId={userId}
            players={players}
            fetchPlayers={fetchPlayers}
            sessions={sessions}
            plans={plans}
            gradings={gradings}
          />
        )}

        {active === "grading" && (
          <GradingTab
            userId={userId}
            players={players}
            gradeRules={gradeRules}
            gradings={gradings}
            fetchGradeRules={fetchGradeRules}
            fetchGradings={fetchGradings}
          />
        )}

        {active === "reports" && (
          <ParentReportTab
            userId={userId}
            players={players}
            sessions={sessions}
            plans={plans}
            gradings={gradings}
          />
        )}

        {active === "settings" && (
          <SettingsTab userId={userId} onChange={(b) => setBranding(b)} />
        )}
      </main>
    </div>
  );
}

