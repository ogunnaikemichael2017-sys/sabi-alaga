"use client";

import { useEffect, useRef, useState } from "react";

const API = "/.netlify/functions/firebase-proxy";
const SDK = "https://www.gstatic.com/firebasejs/10.14.1";

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
  EMAIL_NOT_FOUND: "No account with that email yet. Invited teammates get their details from Michael.",
  INVALID_PASSWORD: "Wrong password.",
  INVALID_LOGIN_CREDENTIALS: "Wrong email or password.",
  EMAIL_EXISTS: "An account with that email already exists. Sign in instead.",
  WEAK_PASSWORD: "Password must be at least 6 characters.",
  OPERATION_NOT_ALLOWED: "Email sign-in isn't switched on yet. Ask Michael to check the backend.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Try again in a few minutes.",
};

function friendlyError(err) {
  if (!err) return "Something went wrong. Try again.";
  if (String(err).startsWith("auth/unauthorized-domain")) {
    return "Google sign-in isn't allowed on this preview address yet. Michael can add this domain in the Firebase console, or I can add it from here.";
  }
  return ERRORS[err] || "Something went wrong (" + err + "). Try again.";
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(s);
  });
}

const G_ICON = (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C36.9 40.2 44 35 44 24c0-1.2-.1-2.3-.4-3.5z"/>
  </svg>
);

export default function AdminClient() {
  const [stage, setStage] = useState("loading"); // loading | form | changepass | authed
  const [notice, setNotice] = useState("");
  const [tone, setTone] = useState("");
  const [cfg, setCfg] = useState(null);
  const [me, setMe] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const googleReady = useRef(null);

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
      // Resume an existing session if the token is still valid.
      const saved = JSON.parse(localStorage.getItem("sa_admin") || "null");
      if (saved && saved.idToken && saved.exp > Date.now() / 1000 + 60) {
        const w = await post({ action: "whoami", idToken: saved.idToken });
        if (w.status === 200 && w.data.role) {
          setMe(w.data);
          setStage(w.data.mustChangePassword ? "changepass" : "authed");
          return;
        }
      }
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

  async function ensureGoogle() {
    if (googleReady.current) return googleReady.current;
    googleReady.current = (async () => {
      await loadScript(`${SDK}/firebase-app-compat.js`);
      await loadScript(`${SDK}/firebase-auth-compat.js`);
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId });
      }
    })();
    return googleReady.current;
  }

  async function remember(idToken, expires) {
    localStorage.setItem("sa_admin", JSON.stringify({ idToken, exp: expires || Math.floor(Date.now() / 1000) + 3300 }));
  }

  function forget() {
    localStorage.removeItem("sa_admin");
  }

  async function finish(idToken, viaMethod, expires) {
    await remember(idToken, expires);
    setMethod(viaMethod || "email");
    const w = await post({ action: "whoami", idToken });
    if (w.status !== 200) {
      show("Sign-in worked but the admin backend could not verify you. Try again.", "bad");
      return;
    }
    const meNow = w.data;
    if (meNow.role) {
      setMe(meNow);
      setStage(meNow.mustChangePassword ? "changepass" : "authed");
      if (!meNow.mustChangePassword) show("Welcome back.", "ok");
      return;
    }
    // No role yet: try the first-owner bootstrap (server decides who qualifies).
    const b = await post({ action: "bootstrapFirstOwner", idToken });
    if (b.status === 200) {
      const w2 = await post({ action: "whoami", idToken });
      setMe({ ...meNow, role: "owner", ...(w2.status === 200 ? w2.data : {}) });
      setStage(meNow.mustChangePassword ? "changepass" : "authed");
      show("Owner access granted. You are the first owner of this site.", "ok");
      return;
    }
    show(
      b.status === 409
        ? "An owner is already set up, and this isn't that account."
        : "Signed in, but this account has no admin role yet. Ask Michael to invite this email.",
      "bad"
    );
  }

  async function onGoogle() {
    if (!cfg) return;
    setBusy(true);
    show("");
    try {
      await ensureGoogle();
      const provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await window.firebase.auth().signInWithPopup(provider);
      const idToken = await cred.user.getIdToken();
      await finish(idToken, "google", Math.floor(Date.now() / 1000) + 3300);
    } catch (e) {
      show(friendlyError(e && (e.code || e.message)), "bad");
    }
    setBusy(false);
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
      await finish(a.data.idToken, "email", Math.floor(Date.now() / 1000) + 3300);
    } catch (e) {
      show("Network problem. Try again.", "bad");
    }
    setBusy(false);
  }

  async function savePassword(e) {
    e.preventDefault();
    if (pw1.length < 8) return show("Use at least 8 characters for your permanent password.", "bad");
    if (pw1 !== pw2) return show("The two passwords don't match.", "bad");
    setBusy(true);
    const saved = JSON.parse(localStorage.getItem("sa_admin") || "null");
    const r = await post({ action: "setPassword", idToken: saved && saved.idToken, password: pw1 });
    if (r.status !== 200) {
      show(r.data.error === "weak password" ? "Use at least 8 characters." : "Could not save the password. Try again.", "bad");
      setBusy(false);
      return;
    }
    setPw1("");
    setPw2("");
    const w = await post({ action: "whoami", idToken: saved.idToken });
    if (w.status === 200) setMe(w.data);
    setStage("authed");
    show(me && !me.hasPassword ? "Password set. You can now sign in with Google or with email and password." : "Password updated.", "ok");
    setBusy(false);
  }

  async function signOut() {
    forget();
    setMe(null);
    setStage("form");
    show("Signed out.", "ok");
    setPassword("");
  }

  const roleLabel = { owner: "Owner", editor: "Editor", contributor: "Contributor", viewer: "Viewer" };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,900&family=Figtree:wght@400;600;700&display=swap" />
      <main className="sa-admin">
      <style>{`
        .sa-admin{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F7F2E9;padding:24px;font-family:"Figtree",system-ui,-apple-system,"Segoe UI",sans-serif;font-synthesis:none}
        .sa-card{background:#fff;border:1px solid #E9E1D3;border-radius:16px;padding:34px 30px 26px;max-width:420px;width:100%;text-align:center;box-shadow:0 14px 40px rgba(23,18,58,.08)}
        .sa-card h1{margin:0 0 8px;font-family:"Fraunces",Georgia,serif;font-style:italic;font-weight:900;font-size:34px;color:#17123A;letter-spacing:0;text-align:left;font-synthesis:none}
        .sa-sub{margin:0 0 20px;color:#6b6478;font-size:14px;text-align:left}
        .sa-google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;border:1.5px solid #17123A;border-radius:10px;background:#fff;color:#17123A;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
        .sa-google:hover{background:#f6f2ea}
        .sa-or{margin:14px 0;color:#8a8298;font-size:13px}
        .sa-field{margin-bottom:14px;text-align:left}
        .sa-field label{display:block;font-size:12px;color:#17123A;margin-bottom:5px;font-weight:600}
        .sa-field input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #DDD4C6;border-radius:10px;font-size:15px;background:#fff;color:#1b1b2f}
        .sa-field input:focus{outline:none;border-color:#C4175F}
        .sa-btn{width:100%;padding:13px;border:none;border-radius:22px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px;font-family:inherit}
        .sa-btn:disabled{opacity:.55;cursor:default}
        .sa-primary{background:#C4175F;color:#fff}
        .sa-ghost{background:transparent;color:#17123A;border:1.5px solid #DDD4C6;border-radius:10px;margin-top:10px;padding:11px}
        .sa-note{margin:14px 0 0;font-size:13.5px;min-height:18px;color:#2b2b3d}
        .sa-note.ok{color:#0d7a3f}
        .sa-note.bad{color:#b3123f}
        .sa-foot{margin:18px 0 0;font-size:12.5px;color:#8a8298;text-align:left}
        .sa-role{display:inline-block;background:#17123A;color:#F2B632;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
        .sa-panel{margin-top:20px;border-top:1px solid #EEE7DA;padding-top:18px;text-align:left}
        .sa-panel h3{margin:0 0 10px;font-size:15px;color:#17123A}
        .sa-hint{font-size:12.5px;color:#8a8298;margin:8px 0 0}
      `}</style>
      <div className="sa-card">
        {stage === "loading" && <p className="sa-sub">Loading&hellip;</p>}

        {stage === "form" && (
          <>
            <h1>Sabi Alaga admin</h1>
            <p className="sa-sub">Manage your website without calling a developer.</p>
            <button className="sa-google" disabled={busy || !cfg} onClick={onGoogle}>
              {G_ICON} Continue with Google
            </button>
            <div className="sa-or">or use your email</div>
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
              {busy ? "Working…" : "Sign in"}
            </button>
            <p className={notice ? `sa-note ${tone}` : "sa-note sa-hint"} role="status">{notice || " "}</p>
            {cfg && cfg.ownerClaimed === false ? (
              <p className="sa-foot">First run: create the account with your email and you become the owner.</p>
            ) : (
              <p className="sa-foot">Only invited emails can sign in. Forgot your password? Reset by email.</p>
            )}
            {cfg && cfg.ownerClaimed === false && (
              <button className="sa-btn sa-ghost" disabled={busy || !email || password.length < 6} onClick={() => onSubmit("signUp")}>
                Create account
              </button>
            )}
          </>
        )}

        {stage === "changepass" && (
          <>
            <h1>One more step</h1>
            <p className="sa-sub">This account still uses a temporary password. Choose your own permanent password to continue.</p>
            <form onSubmit={savePassword}>
              <div className="sa-field">
                <label htmlFor="sa-pw1">New permanent password</label>
                <input id="sa-pw1" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="sa-field">
                <label htmlFor="sa-pw2">Repeat it</label>
                <input id="sa-pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
              </div>
              <button className="sa-btn sa-primary" disabled={busy} type="submit">Save password and continue</button>
            </form>
            <p className={`sa-note ${tone}`} role="status">{notice}</p>
          </>
        )}

        {stage === "authed" && me && (
          <>
            <h1>Sabi Alaga admin</h1>
            <p className="sa-sub">{me.email}</p>
            <span className="sa-role">{roleLabel[me.role] || "No role"}</span>
            <p className="sa-note ok">
              {method === "google" ? "Signed in with Google" : "Signed in with email"}.
              {me.role === "owner" ? " The section editor, media library and publishing tools arrive in the next build phases." : ""}
            </p>
            <div className="sa-panel">
              <h3>{me.hasPassword ? "Password" : "Set a password (optional)"}</h3>
              <form onSubmit={savePassword}>
                <div className="sa-field">
                  <label htmlFor="sa-np">{me.hasPassword ? "New password" : "New password for email sign-in"}</label>
                  <input id="sa-np" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
                </div>
                <div className="sa-field">
                  <label htmlFor="sa-np2">Repeat it</label>
                  <input id="sa-np2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
                </div>
                <button className="sa-btn sa-primary" disabled={busy} type="submit">{me.hasPassword ? "Update password" : "Set password"}</button>
              </form>
              <p className="sa-hint">
                {me.hasPassword
                  ? "You can always sign in with Google or with email and this password."
                  : "Set one now and Google sign-in AND email sign-in both work for this account."}
              </p>
            </div>
            <button className="sa-btn sa-ghost" onClick={signOut}>Sign out</button>
            <p className={`sa-note ${tone}`} role="status">{notice}</p>
          </>
        )}
      </div>
    </main>
    </>
  );
}
