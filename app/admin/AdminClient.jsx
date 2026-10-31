"use client";

import { useEffect, useRef, useState } from "react";
import Editor from "./Editor";
import { Overview, Pages, Media, Enquiries, Team, Settings } from "./panels";
import { loadPending, addPending, clearPending } from "./pending";

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

function VersionHistory({ canRestore, onClose, onRestored }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await post({ action: "listVersions", idToken: JSON.parse(localStorage.getItem("sa_admin") || "null")?.idToken });
      if (alive) setRows(r.status === 200 ? r.data.versions || [] : []);
    })();
    return () => { alive = false; };
  }, []);
  async function restore(page, vid) {
    if (busy) return;
    setBusy(vid);
    const t = JSON.parse(localStorage.getItem("sa_admin") || "null")?.idToken;
    const r = await post({ action: "restoreVersion", idToken: t, page, vid });
    setBusy("");
    if (r.status === 200) onRestored();
    else toastLike(r.data.error || "Could not restore that version.");
  }
  return (
    <>
      <h3>Version history</h3>
      <p className="mut">Restore any earlier version as a new draft.</p>
      {!rows && <p className="mut">Loading&hellip;</p>}
      {rows && rows.length === 0 && <p className="mut">No versions yet. They build up as pages are saved.</p>}
      {rows && rows.map((v) => (
        <div className="row" key={v.page + "/" + v.vid}>
          <span className="nm">
            Version {v.vid.slice(-4)}
            <br />
            <span className="mut">{(v.by || "someone").split("@")[0]} &middot; {v.updated ? new Date(v.updated).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""} &middot; {v.count} sections ({v.page})</span>
          </span>
          {canRestore && <button className="btn s" type="button" disabled={!!busy} onClick={() => restore(v.page, v.vid)}>{busy === v.vid ? "Restoring\u2026" : "Restore"}</button>}
        </div>
      ))}
      <button className="btn" type="button" onClick={onClose}>Close</button>
    </>
  );
}

function toastLike(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

const TABS = [
  ["overview", "Overview"], ["sections", "Sections"], ["pages", "Pages"],
  ["media", "Media"], ["enquiries", "Enquiries"], ["team", "Team"], ["settings", "Settings"],
];

export default function AdminClient() {
  const [stage, setStage] = useState("loading"); // loading | form | changepass | authed
  const [tab, setTab] = useState("overview");
  const [editPage, setEditPage] = useState("home");
  const [notice, setNotice] = useState("");
  const [viewAs, setViewAs] = useState("owner");
  useEffect(() => {
    if (stage !== "authed") {
      document.body.style.backgroundColor = "#14154A";
      return () => { document.body.style.backgroundColor = ""; };
    }
    return undefined;
  }, [stage]);
  const [tone, setTone] = useState("");
  const [cfg, setCfg] = useState(null);
  const [me, setMe] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pend, setPend] = useState(0);
  const [modal, setModal] = useState(null); // {t:"hist"} | {t:"pub"}
  const [toastMsg, setToastMsg] = useState("");
  const [pages, setPages] = useState([]);
  const googleReady = useRef(null);
  const toastTimer = useRef(null);

  const show = (text, kind) => {
    setNotice(text);
    setTone(kind || "");
  };

  const toast = (msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  };

  useEffect(() => { setPend(loadPending()); }, []);

  function bump() { setPend(addPending(1)); }

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

  useEffect(() => {
    if (stage === "authed" && me) {
      (async () => {
        const r = await post({ action: "listPages", idToken: JSON.parse(localStorage.getItem("sa_admin") || "null").idToken });
        if (r.status === 200) setPages(r.data.pages || []);
      })();
    }
  }, [stage, me]);

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
      // The claim only rides on tokens issued AFTER it was granted, so force a
      // fresh token before asking who we are again.
      let fresh = idToken;
      try {
        const u = window.firebase && window.firebase.auth().currentUser;
        if (u) fresh = await u.getIdToken(true);
      } catch (e) {}
      await remember(fresh);
      const w2 = await post({ action: "whoami", idToken: fresh });
      const meOwner = { ...(w2.status === 200 ? w2.data : meNow), role: "owner" };
      setMe(meOwner);
      setStage(meOwner.mustChangePassword ? "changepass" : "authed");
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

  async function doPublish() {
    setModal(null);
    const saved = JSON.parse(localStorage.getItem("sa_admin") || "null");
    const r = await post({ action: "publish", idToken: saved && saved.idToken });
    if (r.status === 200) {
      setPend(clearPending());
      toast("Publish started. The live website updates in 2 to 3 minutes.");
    } else {
      toast(r.data.error === "build hook is not configured" ? "Publish is not wired up yet." : (r.data.error || "Publish failed. Try again."));
    }
  }

  const canEdit = me && ["owner", "editor"].includes(me.role);
  const canPub = canEdit && viewAs === "owner";
  const roleText = pend
    ? "Draft: " + pend + " unpublished change" + (pend === 1 ? "" : "s")
    : "Live: up to date";

  return (
    <div className="sa-admin-root">
      {stage !== "authed" && (
        <main className="login">
          <div className="card">
            {stage === "loading" && <p className="mut">Loading&hellip;</p>}

            {stage === "form" && (
              <>
                <h1>Sabi Alaga admin</h1>
                <p className="mut">Manage your website without calling a developer.</p>
                <button className="btn" disabled={busy || !cfg} onClick={onGoogle} style={{ width: "100%", marginBottom: 6 }}>
                  {G_ICON} Continue with Google
                </button>
                <div className="sep">or use your email</div>
                <label>Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <label>Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    onKeyDown={(e) => { if (e.key === "Enter" && !busy) onSubmit("signIn"); }}
                  />
                </label>
                <button className="btn p" disabled={busy || !email || !password} onClick={() => onSubmit("signIn")} style={{ width: "100%" }}>
                  {busy ? "Working\u2026" : "Sign in"}
                </button>
                <p className="mut" style={{ margin: "12px 0 0", fontSize: 12, color: tone === "bad" ? "var(--fuchsia)" : undefined }} role="status">
                  {notice || "Only invited emails can sign in. Forgot your password? Reset by email."}
                </p>
                {cfg && cfg.ownerClaimed === false && (
                  <button className="btn" disabled={busy || !email || password.length < 6} onClick={() => onSubmit("signUp")} style={{ width: "100%", marginTop: 10 }}>
                    Create account
                  </button>
                )}
              </>
            )}

            {stage === "changepass" && (
              <>
                <h1>One more step</h1>
                <p className="mut">This account still uses a temporary password. Choose your own permanent password to continue.</p>
                <form onSubmit={savePassword}>
                  <label>New permanent password
                    <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
                  </label>
                  <label>Repeat it
                    <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
                  </label>
                  <button className="btn p" disabled={busy} type="submit" style={{ width: "100%" }}>Save password and continue</button>
                </form>
                <p className="mut" style={{ margin: "12px 0 0", fontSize: 12, color: tone === "bad" ? "var(--fuchsia)" : undefined }} role="status">{notice}</p>
              </>
            )}
          </div>
        </main>
      )}

      {stage === "authed" && me && (
        <>
          <div className={"shell" + (canEdit ? "" : " ro")}>
            <nav className="side">
              <div className="lg">Admin</div>
              {TABS.map(([id, label]) => (
                <button key={id} type="button" className={"keep" + (tab === id ? " on" : "")} onClick={() => { setTab(id); }}>
                  {label}
                </button>
              ))}
            </nav>
            <div>
              <div className="top">
                <b style={{ font: "italic 900 18px var(--serif)" }}>The Sabi Alaga</b>
                <span className={"pill " + (pend ? "w" : "ok")}>{roleText}</span>
                {me.role === "owner" && (
                  <label className="viewas">
                    View as
                    <select className="keep" value={viewAs} onChange={(e) => setViewAs(e.target.value)}>
                      <option value="owner">owner</option>
                      <option value="editor">editor</option>
                      <option value="contributor">contributor</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </label>
                )}
                <span className="sp" />
                <button className="btn s keep" type="button" onClick={() => setModal({ t: "hist" })}>History</button>
                <button className="btn s keep" type="button" onClick={() => window.open(window.location.origin, "_blank")}>Preview</button>
                <button
                  className="btn s p"
                  type="button"
                  disabled={!pend || !canEdit}
                  onClick={() => {
                    if (!canPub) { setModal({ t: "req" }); return; }
                    setModal({ t: "pub" });
                  }}
                >
                  {canPub ? "Publish" : "Request approval"}
                </button>
                <button className="btn s keep" type="button" onClick={signOut}>Sign out</button>
              </div>
              <main>
                {tab === "overview" && <Overview me={me} go={setTab} />}
                {tab === "sections" && <Editor me={me} page={editPage} onPageChange={setEditPage} toast={toast} />}
                {tab === "pages" && <Pages me={me} onOpen={(slug) => { setEditPage(slug); setTab("sections"); }} toast={toast} />}
                {tab === "media" && <Media me={me} toast={toast} />}
                {tab === "enquiries" && <Enquiries me={me} toast={toast} />}
                {tab === "team" && <Team me={me} toast={toast} />}
                {tab === "settings" && (
                  <Settings me={me} onSavePassword={savePassword} busy={busy} pw1={pw1} setPw1={setPw1} pw2={pw2} setPw2={setPw2} />
                )}
                {notice && tab !== "sections" && <p className="mut" style={{ marginTop: 10, color: tone === "bad" ? "var(--fuchsia)" : undefined }} role="status">{notice}</p>}
              </main>
            </div>
          </div>
          <div className="tabbar">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" className={"keep" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {modal && (modal.t === "hist" || modal.t === "pub" || modal.t === "req") && (
            <div className="modal" onClick={() => setModal(null)}>
              <div className="card" onClick={(e) => e.stopPropagation()}>
                {modal.t === "hist" && (
                  <VersionHistory
                    canRestore={canEdit}
                    onClose={() => setModal(null)}
                    onRestored={() => { setModal(null); bump(); toast("Version restored as your draft. Press Publish when ready."); }}
                  />
                )}
                {modal.t === "pub" && (
                  <>
                    <h3>Publish to the live site?</h3>
                    <p className="mut">{pend} change{pend === 1 ? "" : "s"} will go live right away. The website updates in 2 to 3 minutes.</p>
                    <button className="btn p" type="button" onClick={doPublish}>Publish now</button>{" "}
                    <button className="btn" type="button" onClick={() => setModal(null)}>Cancel</button>
                  </>
                )}
                {modal.t === "req" && (
                  <>
                    <h3>Request approval</h3>
                    <p className="mut">Only the owner or an editor can publish. Ask them to press Publish when your draft is ready.</p>
                    <button className="btn" type="button" onClick={() => setModal(null)}>Okay</button>
                  </>
                )}
              </div>
            </div>
          )}

          {toastMsg && <div className="toast">{toastMsg}</div>}
        </>
      )}
    </div>
  );
}
