import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthTab({ onAuth }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      onAuth?.(data.session?.user?.id || null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      onAuth?.(s?.user?.id || null);
    });
    return () => sub.subscription.unsubscribe();
  }, [onAuth]);

  async function signIn() {
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setError(error.message);
  }
  async function signUp() {
    setError("");
    const { error } = await supabase.auth.signUp({ email, password: pass });
    if (error) setError(error.message);
  }
  async function signOut() { await supabase.auth.signOut(); }

  if (session) {
    return (
      <div className="app-shell card">
        <h2 className="section-title">Account</h2>
        <p className="mb-3 text-slate-700">Signed in as <strong>{session.user.email}</strong></p>
        <button className="btn btn-outline" onClick={signOut}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="app-shell card">
      <h2 className="section-title">Sign in</h2>
      <div className="grid md:grid-cols-3 gap-3">
        <input className="input" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="input" placeholder="Password" type="password" value={pass} onChange={(e)=>setPass(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-primary" onClick={signIn}>Sign in</button>
          <button className="btn btn-outline" onClick={signUp}>Sign up</button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
