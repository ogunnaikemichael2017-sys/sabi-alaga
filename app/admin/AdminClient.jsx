"use client";

import { useEffect, useState } from "react";

const API = "/.netlify/functions/firebase-proxy";
const LOGO = "https://res.cloudinary.com/di4dlnd5x/image/upload/v1793345855/sabi-alaga/logo.png";

async function post(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function authCall(kind, apiKey, email, password) {
  const url = kind === "signUp"
    ? `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`
    : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const ERRORS = {
  EMAIL_NOT_FOUND: "No account with that email yet. Create the account below first.",
  INVALID_PASSWORD: "Wrong password.",
  INVALID_LOGIN_CREDENTIALS: "Wrong email or password.",
  EMAIL_EXISTS: "An account with that email already exists. Sign in instead.",
  WEAK_PASSWORD: "Password must be at least 6 characters.",
  OPERATION_NOT_ALLOWED: "Email sign-in isn't switched on yet. Ask Michael to check the backend.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Try again in a few minutes.",
};

function friendlyError(err) {
  if (!err) return "Something went wrong. Try again.";
  return ERRORS[err] || "Something went wrong (" + err + "). Try again.";
}

export default function AdminClient() {
  const [stage, setStage] = useState("loading"); // loading | form | authed
  const [notice, setNotice] = useState("");
  const [tone, setTone] = useState(""); // ok | bad
  const [cfg, setCfg] = useState(null);
  const [me, setMe] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const show = (text, kind) => {
    setNotice(text);
    setTone(kind || "");
  };

  async function boot() {
    try {
      const r = await post({ action: "publicConfig" });
      if (r.status !== 200) {
        show("The sign-in backend is still warming up. Refresh in a moment.", "bad");
        setStage("form");
        return;
      }
      setCfg(r.data);
      setStage("form");
    } catch (e) {
      show("Could not reach the sign-in backend. Check your connection.", "bad");
      setStage("form");
    }
  }

  useEffect(() => {
    if (stage === "loading") boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish(idToken, preferred) {
    const w = await post({ action: "whoami", idToken });
    const role = w.status === 200 ? w.data.role : null;
    const meNow = w.status === 200 ? w.data : { email: "", uid: "", role: null };
    if (role) {
      setMe(meNow);
      setStage("authed");
      show(role === "owner" ? "Welcome back, owner." : `Signed in (${role}).`, "ok");
      return;
    }
    // No role yet: try the first-owner bootstrap (server decides who qualifies).
    const b = await post({ action: "bootstrapFirstOwner", idToken });
    if (b.status === 200) {
      setMe({ ...meNow, role: "owner" });
      setStage("authed");
      show("Owner access granted. You are the first owner of this site.", "ok");
      return;
    }
    setMe(meNow);
    setStage("authed");
    show(
      b.status === 409
        ? "An owner is already set up, and this isn't that account."
        : "Signed in, but this account has no admin role yet.",
      "bad"
    );
  }

  async function onSubmit(mode) {
    setBusy(true);
    show("");
    try {
      const a = await authCall(mode, cfg.apiKey, email.trim(), password);
      if (a.status !== 200) {
        show(friendlyError(a.data.error && a.data.error.message && a.data.error.message.split(": ")[0]), "bad");
        setBusy(false);
        return;
      }
      await finish(a.data.idToken);
    } catch (e) {
      show("Network problem. Try again.", "bad");
    }
    setBusy(false);
  }

  async function signOut() {
    setMe(null);
    setStage("form");
    show("Signed out.", "ok");
    setPassword("");
  }

  const roleLabel = { owner: "Owner", editor: "Editor", contributor: "Contributor", viewer: "Viewer" };

  return (
    <main className="sa-admin">
      <style>{`
        .sa-admin{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#14154A;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
        .sa-card{background:#FBF4EA;border-radius:18px;padding:36px 32px;max-width:400px;width:100%;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.35)}
        .sa-card img{display:block;margin:0 auto 18px}
        .sa-card h1{margin:0 0 6px;font-size:24px;color:#14154A;letter-spacing:.02em}
        .sa-sub{margin:0 0 22px;color:#6b6478;font-size:14px}
        .sa-field{margin-bottom:14px;text-align:left}
        .sa-field label{display:block;font-size:12px;color:#14154A;margin-bottom:5px;font-weight:600}
        .sa-field input{width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #d8cfc0;border-radius:10px;font-size:15px;background:#fff;color:#1b1b2f}
        .sa-field input:focus{outline:none;border-color:#C4175F}
        .sa-btn{width:100%;padding:12px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px}
        .sa-btn:disabled{opacity:.6;cursor:default}
        .sa-primary{background:#C4175F;color:#fff}
        .sa-ghost{background:transparent;color:#14154A;border:1.5px solid #d8cfc0;margin-top:10px}
        .sa-note{margin:14px 0 0;font-size:13.5px;min-height:18px;color:#2b2b3d}
        .sa-note.ok{color:#0d7a3f}
        .sa-note.bad{color:#b3123f}
        .sa-role{display:inline-block;background:#14154A;color:#F2B632;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
        .sa-divider{margin:22px 0 0;color:#8a8298;font-size:12px}
      `}</style>
      <div className="sa-card">
        <img src={LOGO} alt="The Sabi Alaga" width="110" height="67" />
        {stage === "loading" && <p className="sa-sub">Loading&hellip;</p>}

        {stage === "form" && (
          <>
            <h1>The Sabi Alaga Admin</h1>
            <p className="sa-sub">Sign in for The Sabi Alaga team.</p>
            <div className="sa-field">
              <label htmlFor="sa-email">Email</label>
              <input id="sa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="sa-field">
              <label htmlFor="sa-pass">Password</label>
              <input
                id="sa-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={(e) => { if (e.key === "Enter" && !busy) onSubmit("signIn"); }}
              />
            </div>
            <button className="sa-btn sa-primary" disabled={busy || !email || !password} onClick={() => onSubmit("signIn")}>
              {busy ? "Working&hellip;" : "Sign in"}
            </button>
            <button className="sa-btn sa-ghost" disabled={busy || !email || password.length < 6} onClick={() => onSubmit("signUp")}>
              Create account
            </button>
            <p className={"sa-note " + tone} role="status">{notice}</p>
            {cfg && cfg.ownerClaimed === false && (
              <p className="sa-divider">First run: create the account with your email and you become the owner.</p>
            )}
          </>
        )}

        {stage === "authed" && me && (
          <>
            <h1>The Sabi Alaga Admin</h1>
            <p className="sa-sub">{me.email}</p>
            <span className="sa-role">{roleLabel[me.role] || "No role"}</span>
            {me.role === "owner" ? (
              <p className="sa-note ok">
                Owner access granted. The section editor, media library and publishing tools arrive in the next build phases.
              </p>
            ) : (
              <p className="sa-note">{notice || "Signed in."}</p>
            )}
            <button className="sa-btn sa-ghost" onClick={signOut}>Sign out</button>
          </>
        )}
      </div>
    </main>
  );
}
