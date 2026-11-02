// Firebase backend proxy for The Sabi Alaga.
// Phase 1 (auth & roles): hardened rebuild.
//  - Key-gated Firestore data actions + setRules (SABI_PROXY_KEY, sha256 + timingSafeEqual).
//  - Open actions that verify a Firebase ID token instead: publicConfig, publicContent, whoami,
//    bootstrapFirstOwner, setUserRole. No secrets ever reach the client.
//  - Diagnostic / project-mutation actions (enableFirestore, createDatabase, deleteDatabase,
//    projects, databases, collections, apiKeyTest, webConfig/orders tests) are gone.

const crypto = require("crypto");

let cachedToken = null; // { token, exp }
let cachedCerts = null; // { map, exp }
let cachedWebConfig = null; // { value, exp }

function svc() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_JSON is not set");
  const json = JSON.parse(raw);
  if (json.private_key) json.private_key = json.private_key.replace(/\\n/g, "\n");
  return json;
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const sa = svc();
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const input = `${b64(header)}.${b64(claims)}`;
  const sig = crypto.createSign("RSA-SHA256").update(input).sign(sa.private_key, "base64url");
  const jwt = `${input}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token endpoint ${res.status}: ${JSON.stringify(data)}`);
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

// ---------- Firebase ID token verification (no admin SDK needed) ----------
async function googleCerts() {
  const now = Date.now();
  if (cachedCerts && cachedCerts.exp > now) return cachedCerts.map;
  const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!res.ok) throw new Error(`cert fetch ${res.status}`);
  const map = await res.json();
  cachedCerts = { map, exp: now + 60 * 60 * 1000 };
  return map;
}

async function verifyIdToken(idToken, projectId) {
  if (!idToken || typeof idToken !== "string" || idToken.length > 4096) throw new Error("bad idToken");
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("bad idToken shape");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  if (header.alg !== "RS256") throw new Error("bad alg");
  const certs = await googleCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error("unknown cert kid");
  const key = new crypto.X509Certificate(pem).publicKey;
  const ok = crypto.createVerify("RSA-SHA256").update(`${parts[0]}.${parts[1]}`).verify(key, Buffer.from(parts[2], "base64url"));
  if (!ok) throw new Error("bad signature");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp < now - 60) throw new Error("token expired");
  if (claims.aud !== projectId) throw new Error("bad audience");
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("bad issuer");
  if (!claims.sub || !claims.user_id) throw new Error("no subject");
  return claims;
}

// ---------- Firestore REST helpers ----------
const B = () => ({ emptyValue: "NULL_VALUE" });
function toFirestore(v) {
  if (v === null || v === undefined) return { nullValue: null };
  const t = typeof v;
  if (t === "string") return { stringValue: v };
  if (t === "boolean") return { booleanValue: v };
  if (t === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (t === "object") {
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestore) } };
    if (v.__timestamp) return { timestampValue: v.__timestamp };
    const fields = {};
    for (const k of Object.keys(v)) fields[k] = toFirestore(v[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}
function fromFirestoreValue(f) {
  if (!f || typeof f !== "object") return f;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return Number(f.doubleValue);
  if ("booleanValue" in f) return f.booleanValue;
  if ("timestampValue" in f) return f.timestampValue;
  if ("nullValue" in f) return null;
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in f) return fromFirestore(f.mapValue.fields);
  return f;
}
function fromFirestore(fields) {
  const out = {};
  if (!fields) return out;
  for (const [k, f] of Object.entries(fields)) {
    if (f === null || f === undefined) { out[k] = null; continue; }
    out[k] = fromFirestoreValue(f);
  }
  return out;
}
function listToArray(arrayValue) {
  return (arrayValue.values || []).map((v) => {
    if ("mapValue" in v) return fromFirestore(v.mapValue.fields);
    if ("arrayValue" in v) return listToArray(v.arrayValue);
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("nullValue" in v) return null;
    return v;
  });
}

const json = (code, body) => ({
  statusCode: code,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-proxy-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

async function docGet(projectId, path) {
  const t = await getAccessToken();
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    headers: { Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function docCreate(projectId, path, data, docId) {
  const t = await getAccessToken();
  const u = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`);
  if (docId) u.searchParams.set("documentId", docId);
  const fields = {};
  for (const k of Object.keys(data || {})) fields[k] = toFirestore(data[k]);
  const r = await fetch(u, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}


async function docUpsert(projectId, path, doc) {
  const g = await docGet(projectId, path);
  if (g.status === 200) {
    const t = await getAccessToken();
    const fields = {};
    for (const k of Object.keys(doc)) fields[k] = toFirestore(doc[k]);
    const mask = Object.keys(doc).map((k) => `updateMask.fieldPaths=${k}`).join("&");
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?${mask}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId, "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  const parts = path.split("/");
  return docCreate(projectId, parts.slice(0, -1).join("/"), doc, parts[parts.length - 1]);
}

// Append one line to the activity log shown on the Overview tab (last 12 kept).
async function logAct(projectId, text) {
  try {
    const a = await docGet(projectId, "meta/activity");
    let arr = a.status === 200 ? (fromFirestore(a.body.fields || {}).activity || []) : [];
    arr = [new Date().toISOString() + "::" + String(text).slice(0, 140)].concat(arr).slice(0, 12);
    await docUpsert(projectId, "meta/activity", { activity: arr });
  } catch (e) {}
}

async function docDelete(projectId, path) {
  const t = await getAccessToken();
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function queryDocs(projectId, structuredQuery) {
  const t = await getAccessToken();
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) ? rows : [])
    .filter((x) => x.document)
    .map((x) => {
      const rel = x.document.name.split("/databases/(default)/documents/")[1] || "";
      return { id: rel.split("/").pop(), path: rel, doc: fromFirestore(x.document.fields || {}) };
    });
}

async function sendInviteEmail({ to, name, role, tempPassword }) {
  // Invite credentials go out via ZeptoMail with the owner's invite template.
  // Merge variables must match the template exactly: first_name, role, temp_password, login_url.
  const host = process.env.ZEPTO_API_HOST || "api.zeptomail.com";
  const url = `https://${host}/v1.1/email/template`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-enczapikey ${process.env.ZEPTO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_key: process.env.ZEPTO_INVITE_TEMPLATE_KEY,
      from: { address: process.env.SENDER_EMAIL, name: "Sabi Alaga" },
      to: [{ email_address: { address: to } }],
      merge_info: {
        first_name: (name || String(to).split("@")[0]) || "there",
        role,
        temp_password: tempPassword,
        login_url: `${process.env.APP_URL || ""}/admin`,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const hdrs = {};
    res.headers.forEach((v, k) => {
      if (/^(x-|content-type)/i.test(k)) hdrs[k] = v;
    });
    console.error("zepto invite send failed:", JSON.stringify({
      url,
      status: res.status,
      body: text.slice(0, 800),
      headers: hdrs,
    }));
    throw new Error(`ZeptoMail ${res.status}: ${text.slice(0, 300)}`);
  }
}

async function setClaims(projectId, localId, attributes) {
  const t = await getAccessToken();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ localId, customAttributes: JSON.stringify(attributes) }),
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, body: d };
}

const ROLES = ["owner", "editor", "contributor", "viewer"];
const FIRST_OWNER_FALLBACK = "ogunnaikemichael2017@gmail.com";
const firstOwnerEmail = () => (process.env.FIRST_OWNER_EMAIL || FIRST_OWNER_FALLBACK).toLowerCase();

async function getWebConfig(projectId) {
  const now = Date.now();
  if (cachedWebConfig && cachedWebConfig.exp > now && cachedWebConfig.value && cachedWebConfig.value.apiKey) return cachedWebConfig.value;
  const t = await getAccessToken();
  const r = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  const d = await r.json().catch(() => ({}));
  const apps = d.apps || [];
  if (!apps.length) return null;
  const app = apps[0];
  let apiKey = "";
  let authDomain = `${projectId}.firebaseapp.com`;
  // Configuration artifact: projects.webApps/getConfig
  try {
    const c = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${app.appId}/config`, { headers: { Authorization: `Bearer ${t}` } });
    const cd = await c.json().catch(() => ({}));
    if (cd.apiKey) apiKey = cd.apiKey;
    if (cd.authDomain) authDomain = cd.authDomain;
  } catch (e) {}
  // Fallback: read the key string straight from the API Keys service
  if (!apiKey && app.apiKeyId) {
    try {
      const ks = await fetch(`https://apikeys.googleapis.com/v2/projects/${projectId}/locations/global/keys/${app.apiKeyId}/keyString`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const kd = await ks.json().catch(() => ({}));
      if (kd.keyString) apiKey = kd.keyString;
    } catch (e) {}
  }
  const value = { webApp: app.name, apiKey, authDomain, projectId };
  if (apiKey) cachedWebConfig = { value, exp: now + 10 * 60 * 1000 };
  return value;
}

// Which actions need the proxy key (server-only operations)
const KEY_ACTIONS = new Set(["get", "list", "create", "update", "delete", "query", "setRules", "health", "setConfig"]);

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let req;
  try {
    req = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "invalid JSON body" });
  }
  const action = req.action;
  if (!action || typeof action !== "string" || action.length > 32) return json(400, { error: "action is required" });

  let sa;
  try { sa = svc(); } catch (e) {
    return json(500, { error: e.message });
  }
  const projectId = sa.project_id;

  // Key gate for server-only actions
  if (KEY_ACTIONS.has(action)) {
    const key = process.env.SABI_PROXY_KEY;
    const given = event.headers["x-proxy-key"] || event.headers["X-Proxy-Key"];
    const eq = (a, b) =>
      crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());
    if (!key || !given || !eq(given, key)) return json(401, { error: "unauthorized" });
  }

  const authz = () => getAccessToken().then((t) => ({ Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId }));

  try {
    // ---------- open actions (Firebase ID token is the credential) ----------
    if (action === "publicConfig") {
      const cfg = await getWebConfig(projectId);
      if (!cfg || !cfg.apiKey) return json(404, { error: "no web app configured yet" });
      const owner = await docGet(projectId, "meta/owner");
      const ownerClaimed = owner.status === 200;
      return json(200, { projectId: cfg.projectId, apiKey: cfg.apiKey, authDomain: cfg.authDomain, ownerClaimed });
    }

    // Published site content: readable by anyone, so the built site can pull it
    // at build time without a key. Serves content/home only.
    if (action === "publicContent") {
      const page = String(req.page || "home").replace(/[^a-z0-9-]/gi, "") || "home";
      const r = await docGet(projectId, `content/${page}`);
      if (r.status !== 200) return json(200, { content: null });
      const doc = fromFirestore(r.body.fields || {});
      return json(200, { content: doc });
    }

    // Save published site content (owner or editor). Writes content/{page}
    // and leaves a version snapshot behind (last 20 kept).
    if (action === "saveContent") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot edit content" });
      const page = String(req.page || "home").replace(/[^a-z0-9-]/gi, "") || "home";
      const sections = Array.isArray(req.sections) ? req.sections : null;
      if (!sections) return json(400, { error: "sections required" });
      if (sections.length > 60) return json(400, { error: "too many sections" });
      for (const sec of sections) {
        if (!sec || typeof sec !== "object" || !sec.id || !sec.type || !sec.data || typeof sec.data !== "object") {
          return json(400, { error: "each section needs id, type and data" });
        }
      }
      const now = new Date().toISOString();
      const title = typeof req.title === "string" ? req.title.trim().slice(0, 120) : undefined;
      const doc = { page, updated: now, updatedBy: claims.email || claims.user_id || "", sections };
      if (title !== undefined) doc.title = title || page;
      const path = `content/${page}`;
      const fields = {};
      for (const k of Object.keys(doc)) fields[k] = toFirestore(doc[k]);
      const authz = await getAccessToken().then((t) => ({ Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId, "Content-Type": "application/json" }));
      const mask = ["page", "updated", "updatedBy", "sections", ...(title !== undefined ? ["title"] : [])].map((k) => `updateMask.fieldPaths=${k}`).join("&");
      let r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?${mask}`, {
        method: "PATCH", headers: authz, body: JSON.stringify({ fields }),
      });
      if (r.status === 404) r = await docCreate(projectId, "content", doc, page);
      if (!r.ok) return json(r.status, await r.json().catch(() => ({})));
      // version snapshot with a simple last-20 cap
      const vid = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8);
      await docCreate(projectId, `${path}/versions`, { updated: now, by: claims.email || claims.user_id || "", sections }, vid);
      try {
        const q = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
          method: "POST", headers: authz,
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "versions", allDescendants: true }], orderBy: [{ field: { fieldPath: "updated" }, direction: "DESCENDING" }], limit: 21 } }),
        });
        const rows = (await q.json()).filter((x) => x.document);
        const extras = rows.slice(20);
        for (const x of extras) {
          await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${x.document.name.split("/databases/(default)/documents/")[1]}`, { method: "DELETE", headers: { Authorization: authz.Authorization, "X-Goog-User-Project": projectId } });
        }
      } catch (e) {}
      await logAct(projectId, "Saved the " + page + " draft");
      return json(200, { ok: true, updated: now, savedBy: doc.updatedBy });
    }

    // Ops: set a user's role by email (key holder only).
    if (action === "setRole") {
      const role = String(req.role || "");
      if (!["owner", "editor", "contributor", "viewer"].includes(role)) return json(400, { error: "bad role" });
      if (!req.email) return json(400, { error: "email required" });
      const t = await getAccessToken();
      const lr = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, {
        method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: [req.email] }),
      });
      const found = ((await lr.json().catch(() => ({}))) || {}).users || [];
      if (!found.length) return json(404, { error: "no such user" });
      const localId = found[0].localId;
      // customAttributes comes back as a JSON string; parse it and keep only
      // known keys so repeated role changes never inflate the claims payload.
      let prev = {};
      try { prev = JSON.parse(found[0].customAttributes || "{}") || {}; } catch (e) { prev = {}; }
      const claims = { role };
      for (const k of Object.keys(prev)) if (typeof k === "string" && !/^\d+$/.test(k) && k !== "role") claims[k] = prev[k];
      const cr = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
        method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ localId, customAttributes: JSON.stringify(claims) }),
      });
      if (!cr.ok) return json(cr.status, await cr.json().catch(() => ({})));
      return json(200, { ok: true, role, email: req.email });
    }

    // Ops: delete a user account by uid (key holder only).
    if (action === "deleteUser") {
      if (!req.uid) return json(400, { error: "uid required" });
      const t = await getAccessToken();
      const dr = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`, {
        method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ localId: req.uid }),
      });
      if (!dr.ok) return json(dr.status, await dr.json().catch(() => ({})));
      return json(200, { ok: true });
    }

    if (action === "whoami") {
      const claims = await verifyIdToken(req.idToken, projectId);
      const t = await getAccessToken();
      const lr = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ localId: claims.user_id }),
      });
      const ld = await lr.json().catch(() => ({}));
      const u = (ld.users || [])[0] || {};
      const providers = (u.providerUserInfo || []).map((x) => x.providerId);
      const owner = await docGet(projectId, "meta/owner");
      return json(200, {
        uid: claims.user_id,
        email: claims.email || null,
        emailVerified: !!claims.email_verified || !!u.emailVerified,
        role: claims.role || null,
        mustChangePassword: !!claims.mustChangePassword,
        hasPassword: !!(u.passwordHash || providers.includes("password")),
        providers,
        ownerClaimed: owner.status === 200,
      });
    }

    if (action === "bootstrapFirstOwner") {
      const claims = await verifyIdToken(req.idToken, projectId);
      const email = (claims.email || "").toLowerCase();
      if (email !== firstOwnerEmail()) return json(403, { error: "this email is not the designated first owner" });
      const owner = await docGet(projectId, "meta/owner");
      if (owner.status === 200) {
        const cur = fromFirestore(owner.body.fields || {});
        if (cur.uid && cur.uid !== claims.user_id) {
          return json(409, { error: "an owner is already set up", claimedEmail: cur.email || null });
        }
      }
      const upd = await setClaims(projectId, claims.user_id, { role: "owner" });
      if (upd.status !== 200) return json(upd.status, { error: "could not set owner claim", detail: upd.body });
      const rec = await docCreate(projectId, "meta", { uid: claims.user_id, email, grantedAt: { __timestamp: new Date().toISOString() } }, "owner");
      return json(200, { ok: true, role: "owner", uid: claims.user_id, ownerRecord: rec.status });
    }

    if (action === "setUserRole") {
      const caller = await verifyIdToken(req.idToken, projectId);
      if (caller.role !== "owner") return json(403, { error: "only an owner can change roles" });
      const targetUid = String(req.targetUid || "");
      const role = String(req.role || "");
      if (!/^[A-Za-z0-9_-]{10,64}$/.test(targetUid)) return json(400, { error: "bad targetUid" });
      if (!ROLES.includes(role)) return json(400, { error: `role must be one of ${ROLES.join(", ")}` });
      const upd = await setClaims(projectId, targetUid, { role });
      if (upd.status !== 200) return json(upd.status, { error: "could not set role", detail: upd.body });
      await docUpsert(projectId, `team/${targetUid}`, { role, status: "Active", updated: new Date().toISOString() });
      return json(200, { ok: true, targetUid, role });
    }

    if (action === "setPassword") {
      // Open action, self-service: sets or changes the caller's own password.
      // Google-only users can add a password here; invited users clear their
      // temporary password here. Requires 8+ characters.
      const claims = await verifyIdToken(req.idToken, projectId);
      const password = String(req.password || "");
      if (password.length < 8) return json(400, { error: "weak password" });
      const apiKey = (await getWebConfig(projectId)).apiKey;
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: req.idToken, password, returnSecureToken: true }),
      });
      if (!r.ok) return json(r.status, { error: "could not set password", detail: await r.json().catch(() => ({})) });
      // Clear mustChangePassword, keep the role.
      const attrs = {};
      if (claims.role) attrs.role = claims.role;
      const upd = await setClaims(projectId, claims.user_id, attrs);
      return json(200, { ok: true, claimsUpdated: upd.status });
    }

    if (action === "inviteUser") {
      // Owner-only: create or update an invited user with a temporary password.
      // The invitee signs in with the temp password (or Google, if they prefer),
      // then must set a permanent password in Settings before using the admin.
      const caller = await verifyIdToken(req.idToken, projectId);
      if (caller.role !== "owner") return json(403, { error: "only an owner can invite" });
      const email = String(req.email || "").trim().toLowerCase();
      const role = String(req.role || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "bad email" });
      if (!ROLES.includes(role) || role === "owner") return json(400, { error: "role must be editor, contributor or viewer" });
      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const tempPassword = String(req.tempPassword || "") || Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
      if (req.tempPassword && req.tempPassword.length < 8) return json(400, { error: "temp password too short" });
      const t = await getAccessToken();
      // Existing user?
      const lr = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const ld = await lr.json().catch(() => ({}));
      let localId = ((ld.users || [])[0] || {}).localId || null;
      if (!localId) {
        const cr = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: tempPassword, emailVerified: true }),
        });
        const cd = await cr.json().catch(() => ({}));
        if (!cr.ok) return json(cr.status, { error: "could not create invited user", detail: cd });
        localId = cd.localId;
      } else {
        const ur = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
          body: JSON.stringify({ localId, password: tempPassword }),
        });
        if (!ur.ok) return json(ur.status, { error: "could not set the temporary password", detail: await ur.json().catch(() => ({})) });
      }
      const upd = await setClaims(projectId, localId, { role, mustChangePassword: true });
      if (upd.status !== 200) return json(upd.status, { error: "could not set role", detail: upd.body });
      const name = String(req.name || "").trim().slice(0, 80) || null;
      const rec = await docCreate(projectId, "invites", { email, name, role, invitedBy: caller.email || null, invitedAt: { __timestamp: new Date().toISOString() } }, email.replace(/[^A-Za-z0-9_.@-]/g, "_"));
      const teamRec = await docCreate(projectId, "team", { email, name, role, status: "Invited", invitedBy: caller.email || null, invitedAt: { __timestamp: new Date().toISOString() } }, localId);
      await logAct(projectId, "Invited " + email + " as " + role);
      let emailSent = false;
      let emailError = null;
      if (process.env.ZEPTO_INVITE_TEMPLATE_KEY && process.env.ZEPTO_API_KEY) {
        try {
          await sendInviteEmail({ to: email, name, role, tempPassword });
          emailSent = true;
        } catch (e) {
          emailError = String((e && e.message) || e).slice(0, 300);
          console.error("invite email failed:", emailError);
        }
      } else {
        emailError = "ZEPTO_INVITE_TEMPLATE_KEY is not set on Netlify";
      }
      return json(200, { ok: true, email, role, tempPassword, emailSent, emailError, inviteRecord: rec.status, teamRecord: teamRec.status });
    }


    // ---------- admin panels: pages, media, enquiries, team, publish ----------
    if (action === "listPages") {
      const claims = await verifyIdToken(req.idToken, projectId);
      const rows = await queryDocs(projectId, { from: [{ collectionId: "content" }] });
      const pages = rows.map((r) => ({
        id: r.id,
        title: r.doc.title || "",
        updated: r.doc.updated || "",
        updatedBy: r.doc.updatedBy || "",
        sectionCount: Array.isArray(r.doc.sections) ? r.doc.sections.length : 0,
      }));
      return json(200, { pages });
    }

    if (action === "savePage") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot create pages" });
      const slug = String(req.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
      if (!slug || slug === "home") return json(400, { error: "pick a page name with letters, numbers or dashes" });
      const title = String(req.title || "").trim().slice(0, 120) || slug;
      const exists = await docGet(projectId, `content/${slug}`);
      if (exists.status === 200) return json(409, { error: "a page with that name already exists" });
      const now = new Date().toISOString();
      const doc = { page: slug, title, sections: [], updated: now, updatedBy: claims.email || claims.user_id || "" };
      const r = await docCreate(projectId, "content", doc, slug);
      if (r.status !== 200) return json(r.status, { error: "could not create the page" });
      return json(200, { ok: true, slug, title });
    }

    if (action === "deletePage") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (claims.role !== "owner") return json(403, { error: "only an owner can delete a page" });
      const slug = String(req.slug || "").replace(/[^a-z0-9-]/g, "");
      if (!slug || slug === "home") return json(400, { error: "the home page cannot be deleted" });
      const r = await docDelete(projectId, `content/${slug}`);
      if (r.status !== 200 && r.status !== 404) return json(r.status, { error: "could not delete the page" });
      return json(200, { ok: true, slug });
    }

    if (action === "listMedia") {
      await verifyIdToken(req.idToken, projectId);
      const r = await docGet(projectId, "media/library");
      if (r.status !== 200) return json(200, { items: [] });
      const doc = fromFirestore(r.body.fields || {});
      return json(200, { items: Array.isArray(doc.items) ? doc.items : [] });
    }

    if (action === "saveMedia") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot change the media library" });
      const items = Array.isArray(req.items) ? req.items : null;
      if (!items) return json(400, { error: "items required" });
      if (items.length > 1000) return json(400, { error: "too many items" });
      const clean = items
        .map((it) => ({
          id: String((it && it.id) || "").slice(0, 64),
          name: String((it && it.name) || "").slice(0, 120),
          type: String((it && it.type) || "image").slice(0, 12),
          kb: Number(it && it.kb) || 0,
          url: String((it && it.url) || "").slice(0, 2048),
          alt: String((it && it.alt) || "").slice(0, 300),
          f: String((it && it.f) || "").slice(0, 64),
        }))
        .filter((it) => it.id && it.url);
      const now = new Date().toISOString();
      const doc = { items: clean, updated: now, updatedBy: claims.email || claims.user_id || "" };
      const r = await docUpsert(projectId, "media/library", doc);
      if (r.status !== 200) return json(r.status, { error: "could not save the media library" });
      await logAct(projectId, "Updated the media library");
      return json(200, { ok: true, items: clean.length });
    }

    if (action === "submitEnquiry") {
      // Open action: the public booking form posts here (no credentials).
      const clean = (v, n) => String(v || "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);
      const name = clean(req.name, 120);
      const contact = clean(req.contact, 80);
      const eventType = clean(req.eventType, 60);
      const date = clean(req.date, 40);
      const location = clean(req.location, 80);
      const note = clean(req.note, 500);
      if (!name) return json(400, { error: "a name is required" });
      const id = "enq-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      const r = await docCreate(projectId, "enquiries", { name, contact, eventType, date, location, note, status: "New", createdAt: { __timestamp: new Date().toISOString() } }, id);
      if (r.status !== 200) return json(r.status, { error: "could not save the enquiry" });
      await logAct(projectId, "New enquiry from " + name);
      return json(200, { ok: true, id });
    }

    if (action === "listEnquiries") {
      await verifyIdToken(req.idToken, projectId);
      const rows = await queryDocs(projectId, { from: [{ collectionId: "enquiries" }], orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }], limit: 100 });
      return json(200, { enquiries: rows.map((r) => ({ id: r.id, ...r.doc })) });
    }

    if (action === "updateEnquiry") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot update enquiries" });
      const id = String(req.id || "").replace(/[^A-Za-z0-9-]/g, "");
      const status = String(req.status || "");
      if (!id || !["New", "Replied", "Closed"].includes(status)) return json(400, { error: "bad enquiry update" });
      const chk = await docGet(projectId, `enquiries/${id}`);
      if (chk.status !== 200) return json(404, { error: "no such enquiry" });
      const r = await docUpsert(projectId, `enquiries/${id}`, { status, updated: new Date().toISOString() });
      if (r.status !== 200) return json(r.status, { error: "could not update the enquiry" });
      return json(200, { ok: true, id, status });
    }

    if (action === "deleteEnquiry") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot delete enquiries" });
      const id = String(req.id || "").replace(/[^A-Za-z0-9-]/g, "");
      if (!id) return json(400, { error: "id required" });
      await docDelete(projectId, `enquiries/${id}`);
      return json(200, { ok: true, id });
    }

    if (action === "listTeam") {
      await verifyIdToken(req.idToken, projectId);
      const rows = await queryDocs(projectId, { from: [{ collectionId: "team", allDescendants: true }] });
      const team = rows.map((r) => ({ uid: r.id, ...r.doc }));
      if (!team.some((m) => m.role === "owner")) {
        // The owner bootstrapped directly (no invite), so seed their row once.
        const own = await docGet(projectId, "meta/owner");
        let owner = null;
        if (own.status === 200) owner = fromFirestore(own.body.fields || {});
        if (!owner || !owner.email) {
          const fb = process.env.FIRST_OWNER_EMAIL || "";
          if (fb) owner = { uid: null, email: fb, role: "owner", status: "Active" };
        }
        if (owner && owner.email) {
          const rec = { email: owner.email, role: "owner", status: "Active" };
          if (owner.uid && /^[A-Za-z0-9_-]{10,64}$/.test(String(owner.uid))) {
            await docUpsert(projectId, `team/${owner.uid}`, rec);
            team.unshift({ uid: owner.uid, ...rec });
          } else {
            team.unshift({ uid: "owner", ...rec });
          }
        }
      }
      return json(200, { team });
    }

    if (action === "removeUser") {
      const caller = await verifyIdToken(req.idToken, projectId);
      if (caller.role !== "owner") return json(403, { error: "only an owner can remove a member" });
      const targetUid = String(req.targetUid || "");
      if (!/^[A-Za-z0-9_-]{10,64}$/.test(targetUid)) return json(400, { error: "bad targetUid" });
      if (targetUid === caller.user_id) return json(400, { error: "you cannot remove yourself" });
      const own = await docGet(projectId, "meta/owner");
      if (own.status === 200) {
        const cur = fromFirestore(own.body.fields || {});
        if (cur.uid === targetUid) return json(400, { error: "the site owner cannot be removed" });
      }
      const t = await getAccessToken();
      const dr = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`, {
        method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ localId: targetUid }),
      });
      await docDelete(projectId, `team/${targetUid}`);
      return json(200, { ok: true, accountDeleted: dr.ok });
    }

    if (action === "publish") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot publish" });
      const c = await docGet(projectId, "meta/config");
      const cfg = c.status === 200 ? fromFirestore(c.body.fields || {}) : {};
      if (!cfg.buildHook) return json(503, { error: "publishing is not wired up yet. Ask Michael to connect the build hook." });
      const r = await fetch(cfg.buildHook, { method: "POST" });
      if (r.status !== 200) return json(r.status, { error: "the publish request was refused. Try again." });
      return json(200, { ok: true });
    }

    // ---------- signed-in meta: settings, blocked dates, activity, versions ----------
    if (action === "getMeta") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!claims.role) return json(403, { error: "sign in required" });
      const [st, bl, ac] = await Promise.all([
        docGet(projectId, "meta/settings"), docGet(projectId, "meta/blocked"), docGet(projectId, "meta/activity"),
      ]);
      return json(200, {
        settings: st.status === 200 ? fromFirestore(st.body.fields || {}) : {},
        blocked: bl.status === 200 ? (fromFirestore(bl.body.fields || {}).blocked || []) : [],
        activity: ac.status === 200 ? (fromFirestore(ac.body.fields || {}).activity || []) : [],
      });
    }

    // Save site settings (owner or editor).
    if (action === "saveMeta") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot change settings" });
      const st = req.settings && typeof req.settings === "object" ? req.settings : null;
      if (!st) return json(400, { error: "settings required" });
      const out = {};
      for (const k of ["brand", "wa", "pop", "ig", "tt", "seoT", "seoD", "logo"]) {
        if (typeof st[k] === "string") out[k] = st[k].slice(0, 500);
      }
      const r = await docUpsert(projectId, "meta/settings", out);
      if (r.status !== 200 && r.status !== 201) return json(r.status, r.body);
      await logAct(projectId, "Updated the site settings");
      return json(200, { ok: true });
    }

    // Block or open one date on the calendar (owner or editor).
    if (action === "toggleBlocked") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot change the calendar" });
      const key = String(req.key || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return json(400, { error: "bad date" });
      const b = await docGet(projectId, "meta/blocked");
      let arr = b.status === 200 ? (fromFirestore(b.body.fields || {}).blocked || []) : [];
      arr = arr.includes(key) ? arr.filter((x) => x !== key) : arr.concat([key]).sort();
      const r = await docUpsert(projectId, "meta/blocked", { blocked: arr });
      if (r.status !== 200 && r.status !== 201) return json(r.status, r.body);
      const pretty = new Date(key + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      await logAct(projectId, arr.includes(key) ? "Blocked " + pretty : "Opened " + pretty);
      return json(200, { ok: true, blocked: arr });
    }

    // Version history across every page (last 20 kept per page).
    if (action === "listVersions") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!claims.role) return json(403, { error: "sign in required" });
      const t = await getAccessToken();
      const q = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
        method: "POST", headers: { Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId, "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "versions", allDescendants: true }], orderBy: [{ field: { fieldPath: "updated" }, direction: "DESCENDING" }], limit: 40 } }),
      });
      const rows = (await q.json()).filter((x) => x.document).map((x) => {
        const seg = x.document.name.split("/documents/")[1].split("/");
        const d = fromFirestore(x.document.fields || {});
        return { page: seg[1], vid: seg[3], updated: d.updated, by: d.by, count: (d.sections || []).length };
      });
      return json(200, { versions: rows });
    }

    // Restore an earlier version as the current draft (owner or editor).
    if (action === "restoreVersion") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot restore versions" });
      const page = String(req.page || "home").replace(/[^a-z0-9-]/gi, "") || "home";
      const vid = String(req.vid || "");
      if (!/^[0-9a-z-]{6,40}$/i.test(vid)) return json(400, { error: "bad version" });
      const v = await docGet(projectId, `content/${page}/versions/${vid}`);
      if (v.status !== 200) return json(404, { error: "no such version" });
      const vd = fromFirestore(v.body.fields || {});
      if (!Array.isArray(vd.sections) || !vd.sections.length) return json(400, { error: "that version is empty" });
      const now = new Date().toISOString();
      const by = claims.email || claims.user_id || "";
      const nv = { updated: now, updatedBy: by, sections: vd.sections };
      const authz = await getAccessToken().then((t) => ({ Authorization: `Bearer ${t}`, "X-Goog-User-Project": projectId, "Content-Type": "application/json" }));
      const mask = ["updated", "updatedBy", "sections"].map((k) => `updateMask.fieldPaths=${k}`).join("&");
      const fields = {};
      for (const k of Object.keys(nv)) fields[k] = toFirestore(nv[k]);
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/content/${page}?${mask}`, {
        method: "PATCH", headers: authz, body: JSON.stringify({ fields }),
      });
      if (!r.ok) return json(r.status, await r.json().catch(() => ({})));
      await docCreate(projectId, `content/${page}/versions`, { updated: now, by, sections: vd.sections }, String(Date.now()) + "-rest");
      await logAct(projectId, "Restored an earlier version of " + page);
      await logAct(projectId, "Sent the website live");
      return json(200, { ok: true });
    }

    // ---------- Cloudinary (signed, server-side; keys live only in Netlify env) ----------
    if (action === "cloudInfo") {
      await verifyIdToken(req.idToken, projectId);
      const name = process.env.CLOUDINARY_NAME || "";
      const key = process.env.CLOUDINARY_KEY || "";
      const secret = process.env.CLOUDINARY_SECRET || "";
      return json(200, { cloud: name || null, keySet: Boolean(key), secretSet: Boolean(secret) });
    }

    if (action === "cloudList") {
      await verifyIdToken(req.idToken, projectId);
      const cname = process.env.CLOUDINARY_NAME || "";
      const ckey = process.env.CLOUDINARY_KEY || "";
      const csec = process.env.CLOUDINARY_SECRET || "";
      if (!cname || !ckey || !csec) return json(500, { error: "Cloudinary keys are not configured on Netlify yet" });
      const auth = "Basic " + Buffer.from(ckey + ":" + csec).toString("base64");
      const out = [];
      for (const type of ["video", "image"]) {
        let url = `https://api.cloudinary.com/v1_1/${cname}/resources/${type}/upload?max_results=100`;
        for (let page = 0; page < 6 && url; page++) {
          const r = await fetch(url, { headers: { Authorization: auth } });
          if (!r.ok) return json(r.status === 200 ? 502 : r.status, { error: "Cloudinary list failed for " + type, detail: await r.json().catch(() => ({})) });
          const j = await r.json();
          for (const res of j.resources || []) {
            const short = String(res.public_id || "").split("/").pop() || "file";
            out.push({
              id: res.public_id,
              name: short + "." + (res.format || ""),
              type,
              kb: Math.round((res.bytes || 0) / 1024),
              url: res.secure_url,
              created: res.created_at || "",
            });
          }
          url = j.next_cursor ? `https://api.cloudinary.com/v1_1/${cname}/resources/${type}/upload?max_results=100&next_cursor=${encodeURIComponent(j.next_cursor)}` : null;
        }
      }
      return json(200, { items: out });
    }

    if (action === "cloudUpload") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot upload media" });
      const cname = process.env.CLOUDINARY_NAME || "";
      const ckey = process.env.CLOUDINARY_KEY || "";
      const csec = process.env.CLOUDINARY_SECRET || "";
      if (!cname || !ckey || !csec) return json(500, { error: "Cloudinary keys are not configured on Netlify yet" });
      const file = String(req.file || "");
      if (!/^data:[^;]+;base64,/.test(file) || file.length > 9000000) return json(400, { error: "file must be a base64 data URI under about 6 MB" });
      const rtype = req.resourceType === "video" ? "video" : "image";
      const ts = String(Math.floor(Date.now() / 1000));
      const params = { timestamp: ts };
      if (req.folder) params.folder = String(req.folder).replace(/[^A-Za-z0-9_\-/]/g, "").slice(0, 60);
      const base = Object.keys(params).sort().map((k) => k + "=" + params[k]).join("&") + csec;
      const sig = crypto.createHash("sha1").update(base).digest("hex");
      const fd = new URLSearchParams();
      fd.append("file", file);
      fd.append("api_key", ckey);
      fd.append("timestamp", ts);
      fd.append("signature", sig);
      if (params.folder) fd.append("folder", params.folder);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${cname}/${rtype}/upload`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.secure_url) return json(r.status === 200 ? 502 : r.status, { error: "Cloudinary upload failed", detail: j.error || j });
      await logAct(projectId, "Uploaded " + ((j.original_filename || "file") + "." + (j.format || "")) + " to Cloudinary");
      return json(200, { ok: true, public_id: j.public_id, secure_url: j.secure_url, resource_type: j.resource_type, bytes: j.bytes || 0, original_filename: j.original_filename || "", format: j.format || "" });
    }

    if (action === "cloudDelete") {
      const claims = await verifyIdToken(req.idToken, projectId);
      if (!["owner", "editor"].includes(claims.role)) return json(403, { error: "your role cannot delete media" });
      const cname = process.env.CLOUDINARY_NAME || "";
      const ckey = process.env.CLOUDINARY_KEY || "";
      const csec = process.env.CLOUDINARY_SECRET || "";
      if (!cname || !ckey || !csec) return json(500, { error: "Cloudinary keys are not configured on Netlify yet" });
      const pid = String(req.publicId || "").trim();
      if (!pid || pid.length > 200) return json(400, { error: "publicId required" });
      const rtype = req.resourceType === "video" ? "video" : "image";
      const ts = String(Math.floor(Date.now() / 1000));
      const base = "public_id=" + pid + "&timestamp=" + ts + csec;
      const sig = crypto.createHash("sha1").update(base).digest("hex");
      const fd = new URLSearchParams();
      fd.append("public_id", pid);
      fd.append("api_key", ckey);
      fd.append("timestamp", ts);
      fd.append("signature", sig);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${cname}/${rtype}/destroy`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return json(r.status === 200 ? 502 : r.status, { error: "Cloudinary delete failed", detail: j.error || j });
      await logAct(projectId, "Deleted " + pid + " from Cloudinary");
      return json(200, { ok: j.result === "ok" || j.result === "not found", result: j.result || "" });
    }

    // ---------- key-gated actions ----------
    if (action === "health") return json(200, { ok: true, projectId });

    if (action === "setConfig") {
      const buildHook = String(req.buildHook || "").trim();
      if (buildHook && !/^https:\/\/api\.netlify\.com\/build_hooks\//.test(buildHook)) return json(400, { error: "bad build hook url" });
      const r = await docUpsert(projectId, "meta/config", { buildHook, updated: new Date().toISOString() });
      if (r.status !== 200) return json(r.status, { error: "could not save the config" });
      return json(200, { ok: true });
    }

    if (action === "setRules") {
      const rules = (req.rules || "").trim();
      if (!rules) return json(400, { error: "rules content is required" });
      let r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, { method: "POST", headers: { ...(await authz()), "Content-Type": "application/json" }, body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: rules }] } }) });
      let d = await r.json();
      if (!r.ok) return json(r.status, d);
      const rsName = d.name;
      const relBody = JSON.stringify({ name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: rsName });
      r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, { method: "POST", headers: { ...(await authz()), "Content-Type": "application/json" }, body: relBody });
      d = await r.json();
      if (!r.ok) {
        const postErr = d;
        const r2 = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, { method: "PATCH", headers: { ...(await authz()), "Content-Type": "application/json" }, body: JSON.stringify({ release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: rsName } }) });
        const d2b = await r2.json();
        return json(r2.status, { postError: postErr, ruleset: rsName, release: d2b });
      }
      return json(200, { ruleset: rsName, release: d });
    }

    if (["get", "list", "create", "update", "delete", "query"].includes(action)) {
      if (!req.collection || !/^[A-Za-z0-9_\/ -]+$/.test(req.collection)) return json(400, { error: "bad collection path" });
      if (req.docId && !/^[A-Za-z0-9_-]+$/.test(req.docId)) return json(400, { error: "bad docId" });
      const dbId = encodeURIComponent(req.databaseId || "(default)");
      const apiV = req.apiVersion === "v1beta1" ? "v1beta1" : "v1";
      const base = `https://firestore.googleapis.com/${apiV}/projects/${projectId}/databases/${dbId}/documents/${req.collection.split("/").map(encodeURIComponent).join("/")}`;

      if (action === "get") {
        if (!req.docId) return json(400, { error: "docId required for get" });
        const r = await fetch(`${base}/${req.docId}`, { headers: await authz() });
        const d = await r.json();
        if (!r.ok) return json(r.status, d);
        const out = fromFirestore(d.fields);
        out.__id = d.name.split("/").pop();
        out.__createTime = d.createTime;
        out.__updateTime = d.updateTime;
        return json(200, out);
      }

      if (action === "list") {
        const u = new URL(base);
        if (req.pageSize) u.searchParams.set("pageSize", String(Math.min(req.pageSize, 300)));
        if (req.pageToken) u.searchParams.set("pageToken", req.pageToken);
        if (req.orderBy) u.searchParams.set("orderBy", req.orderBy);
        if (req.mask) u.searchParams.set("mask.fieldPaths", req.mask);
        const r = await fetch(u, { headers: await authz() });
        const d = await r.json();
        if (!r.ok) return json(r.status, d);
        const docs = (d.documents || []).map((doc) => ({
          ...fromFirestore(doc.fields),
          __id: doc.name.split("/").pop(),
          __createTime: doc.createTime,
          __updateTime: doc.updateTime,
        }));
        return json(200, { docs, nextPageToken: d.nextPageToken || null });
      }

      if (action === "create") {
        const fields = {};
        for (const k of Object.keys(req.data || {})) fields[k] = toFirestore(req.data[k]);
        const url = new URL(base);
        if (req.docId) url.searchParams.set("documentId", req.docId);
        const r = await fetch(url, {
          method: "POST",
          headers: { ...(await authz()), "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
        const d = await r.json();
        if (!r.ok) return json(r.status, d);
        return json(200, { ...fromFirestore(d.fields), __id: d.name.split("/").pop(), __updateTime: d.updateTime });
      }

      if (action === "update") {
        if (!req.docId) return json(400, { error: "docId required for update" });
        const fields = {};
        for (const k of Object.keys(req.data || {})) fields[k] = toFirestore(req.data[k]);
        const paths = Object.keys(fields);
        const u = new URL(`${base}/${req.docId}`);
        if (paths.length) u.searchParams.set("updateMask.fieldPaths", paths.join(","));
        const r = await fetch(u, {
          method: "PATCH",
          headers: { ...(await authz()), "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
        const d = await r.json();
        if (!r.ok) return json(r.status, d);
        return json(200, { ...fromFirestore(d.fields), __id: d.name.split("/").pop(), __updateTime: d.updateTime });
      }

      if (action === "delete") {
        if (!req.docId) return json(400, { error: "docId required for delete" });
        const r = await fetch(`${base}/${req.docId}`, { method: "DELETE", headers: await authz() });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return json(r.status, d);
        return json(200, { ok: true });
      }

      if (action === "query") {
        const structuredQuery = { from: [{ collectionId: req.collection.split("/").pop(), allDescendants: req.collection.includes("/") }] };
        if (req.where && Array.isArray(req.where)) {
          structuredQuery.where = { fieldFilter: { field: { fieldPath: req.where[0] }, op: req.where[1], value: toFirestore(req.where[2]) } };
        }
        if (req.orderBy) {
          const [fieldPath, dir] = Array.isArray(req.orderBy) ? req.orderBy : [req.orderBy, "ASCENDING"];
          structuredQuery.orderBy = [{ field: { fieldPath }, direction: dir || "ASCENDING" }];
        }
        if (req.max) structuredQuery.limit = Math.min(req.max, 300);
        const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
          method: "POST",
          headers: { ...(await authz()), "Content-Type": "application/json" },
          body: JSON.stringify({ structuredQuery }),
        });
        const d = await r.json();
        if (!r.ok) return json(r.status, d);
        const docs = d
          .filter((x) => x.document)
          .map((x) => ({ ...fromFirestore(x.document.fields), __id: x.document.name.split("/").pop() }));
        return json(200, { docs });
      }
    }

    return json(400, { error: `unknown action: ${action}` });
  } catch (e) {
    return json(502, { error: e.message || "proxy error" });
  }
};
