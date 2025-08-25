// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase"; // keep your client import

// Your existing tabs/components
import PlansTab from "./components/PlansTab";
import SessionsTab from "./components/SessionsTab";
import PlayersTab from "./components/PlayersTab";
import ParentReportTab from "./components/ParentReportTab";
import GradingTab from "./components/GradingTab";
import SettingsTab from "./components/SettingsTab";
import SessionPlannerTab from "./components/SessionPlannerTab";

// Intro overlay
import EliteIntro from "./components/EliteIntro";
import logo from "./assets/powerplay-logo.png";

/* ----------------- Error Boundary (prevents blank screen) ----------------- */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl m-4">
          <div className="font-semibold mb-2">Something went wrong.</div>
          <pre className="whitespace-pre-wrap">{String(this.state.error?.message || this.state.error)}</pre>
          <button className="mt-3 px-3 py-2 border rounded-lg" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ----------------- Minimal Sign-In (with labels/ids) ----------------- */
function SignInCard() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
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
        <p className="text-sm text-slate-600 mb-3">Please sign in to access your dashboard.</p>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Email</span>
            <input
              id="login-email"
              name="email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Password</span>
            <input
              id="login-password"
              name="password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        </div>

        {msg && <p className="text-sm text-red-600 mt-2">{msg}</p>}

        <div className="flex gap-2 mt-3">
          <button className="btn-primary" onClick={signIn}>Sign in</button>
          <button className="btn btn-outline" onClick={signUp}>Create account</button>
        </div>
      </div>
    </div>
  );
}

/* ----------------- App ----------------- */
export default function App() {
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // intro overlay shown after login
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    let mounted = true;

    // initial session (refresh etc.)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      setUserId(user?.id || null);
      setUserEmail(user?.email || "");
      if (user) setShowIntro(true);
    });

    // auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user ?? null;
      setUserId(user?.id || null);
      setUserEmail(user?.email || "");
      if (user) setShowIntro(true);
      else setShowIntro(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  // Optional branding from your DB/storage
  const [branding, setBranding] = useState(null);
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

  // Tabs
  const TABS = useMemo(
    () => [
      { key: "plans", label: "Plans" },
      { key: "designer", label: "Session Designer" },
      { key: "sessions", label: "Sessions" },
      { key: "players", label: "Players" },
      { key: "grading", label: "Grading" },
      { key: "reports", label: "Reports" },
      { key: "settings", label: "Settings" },
    ],
    []
  );
  const [active, setActive] = useState("plans");

  // Data
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [gradeRules, setGradeRules] = useState([]);
  const [gradings, setGradings] = useState([]);

  // Fetchers
  async function fetchPlans() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("plans").select("*").eq("user_id", userId).order("title");
    if (error) {
      console.error("fetchPlans error:", error);
      alert(`Couldn't fetch plans: ${error.message}`);
      setPlans([]);
      return;
    }
    const mapped = (data || []).map((p) => ({
      ...p,
      defaultLocation: p.defaultLocation ?? p.default_location ?? "",
      defaultTime: p.defaultTime ?? p.default_time ?? "",
      fourCorners: p.fourCorners ?? p.four_corners ?? {},
      attachmentPaths: p.attachments ?? p.attachmentPaths ?? p.attachment_paths ?? [],
    }));
    setPlans(mapped);
  }

  async function fetchSessions() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("sessions").select("*").eq("user_id", userId).order("date", { ascending: false });
    if (error) {
      console.error("fetchSessions error:", error);
      alert(`Couldn't fetch sessions: ${error.message}`);
      setSessions([]);
      return;
    }
    setSessions(data || []);
  }

  async function fetchPlayers() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("players").select("*").eq("user_id", userId).order("name");
    if (error) {
      console.error("fetchPlayers error:", error);
      alert(`Couldn't fetch players: ${error.message}`);
      setPlayers([]);
      return;
    }
    setPlayers(data || []);
  }

  async function fetchGradeRules() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("grading_rules").select("*").eq("user_id", userId).order("area").order("target_belt");
    if (error) {
      console.error("fetchGradeRules error:", error);
      alert(`Couldn't fetch grading rules: ${error.message}`);
      setGradeRules([]);
      return;
    }
    setGradeRules(data || []);
  }

  async function fetchGradings() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("player_gradings").select("*").eq("user_id", userId).order("scheduled_date", { ascending: true });
    if (error) {
      console.error("fetchGradings error:", error);
      alert(`Couldn't fetch gradings: ${error.message}`);
      setGradings([]);
      return;
    }
    setGradings(data || []);
  }

  useEffect(() => {
    if (!userId) return;
    fetchPlans();
    fetchSessions();
    fetchPlayers();
    fetchGradeRules();
    fetchGradings();
  }, [userId]);

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

  /* --------- LOGGED OUT --------- */
  if (!userId) {
    return <SignInCard />;
  }

  /* --------- LOGGED IN APP --------- */
  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="app-shell">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="text-xl font-semibold">Elite Player Manager</div>
            {branding && (
              <span
                className="inline-flex items-center gap-2 px-2 py-1 rounded-full border text-sm"
                style={{ borderColor: accent }}
                title={branding.slogan || branding.brand_name}
              >
                {logoUrl && <img src={logoUrl} alt="logo" className="w-5 h-5 rounded" />}
                <span className="font-medium" style={{ color: accent }}>
                  {branding.brand_name || "Brand"}
                </span>
                {branding.slogan && <span className="text-xs text-slate-500">— {branding.slogan}</span>}
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2">
            {userEmail && <span className="text-sm text-slate-600 truncate max-w-[150px]">{userEmail}</span>}
            <button className="btn btn-outline" onClick={logout}>Logout</button>
          </div>

          <div className="flex md:hidden">
            <button className="btn btn-outline" onClick={() => setMobileMenuOpen((prev) => !prev)}>
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Desktop tabs */}
        <nav className="top-tabs hidden md:flex">
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

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="flex flex-col gap-2 mt-2 md:hidden">
            {userEmail && <span className="text-sm text-slate-600 truncate max-w-full">{userEmail}</span>}
            <button className="btn btn-outline w-full" onClick={logout}>Logout</button>
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab w-full text-left ${active === t.key ? "tab-active" : ""}`}
                onClick={() => { setActive(t.key); setMobileMenuOpen(false); }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ background: accent, height: 2 }} />
      </header>

      <main className="mt-4">
        {active === "plans" && (
          <PlansTab
            userId={userId}
            plans={plans}
            fetchPlans={fetchPlans}
            onSchedulePlan={handleSchedulePlan}
          />
        )}

        {active === "designer" && (
          <div className="h-[calc(100vh-160px)]">
            {/* Only wrap the designer in an error boundary to avoid full-app white screens */}
            <ErrorBoundary>
              <SessionPlannerTab />
            </ErrorBoundary>
          </div>
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

        {active === "settings" && <SettingsTab userId={userId} onChange={(b) => setBranding(b)} />}
      </main>

      {/* Intro overlay: shows every time you log in, click triggers fullscreen */}
      {showIntro && (
        <EliteIntro
          onFinish={() => setShowIntro(false)}
          logoSrc={logoUrl || logo}
          appName="POWERPLAY"
          tagline="ELITE PLAYER MANAGER"
          primary="#111111"
          secondary="#6EC1FF"
          duration={2200}
          autoDismiss={false}     // require click so fullscreen is allowed
          forceFullscreen={true}  // request fullscreen on click
        />
      )}
    </div>
  );
}
