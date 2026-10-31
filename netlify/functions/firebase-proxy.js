// Firebase backend proxy for The Sabi Alaga.
// Phase 1 (auth & roles): hardened rebuild.
//  - Key-gated Firestore data actions + setRules (SABI_PROXY_KEY, sha256 + timingSafeEqual).
//  - Open actions that verify a Firebase ID token instead: publicConfig, whoami,
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
function fromFirestore(fields) {
  const out = {};
  if (!fields) return out;
  for (const [k, f] of Object.entries(fields)) {
    if (f === null || f === undefined) { out[k] = null; continue; }
    if ("stringValue" in f) out[k] = f.stringValue;
    else if ("integerValue" in f) out[k] = Number(f.integerValue);
    else if ("doubleValue" in f) out[k] = Number(f.doubleValue);
    else if ("booleanValue" in f) out[k] = f.booleanValue;
    else if ("timestampValue" in f) out[k] = f.timestampValue;
    else if ("nullValue" in f) out[k] = null;
    else if ("arrayValue" in f) out[k] = (f.arrayValue.values || []).map((x) => fromFirestore(x.__x || x));
    else if ("mapValue" in f) out[k] = fromFirestore(f.mapValue.fields);
    else out[k] = f;
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

async function setClaims(projectId, localId, attributes) {
  const t = await getAccessToken();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ localId, customAttributes: JSON.stringify(attributes) }] }),
  });
  const d = await r.json();
  return { status: r.status, body: d };
}

const ROLES = ["owner", "editor", "contributor", "viewer"];
const FIRST_OWNER_FALLBACK = "ogunnaikemichael2017@gmail.com";
const firstOwnerEmail = () => (process.env.FIRST_OWNER_EMAIL || FIRST_OWNER_FALLBACK).toLowerCase();

async function getWebConfig(projectId) {
  const now = Date.now();
  if (cachedWebConfig && cachedWebConfig.exp > now) return cachedWebConfig.value;
  const t = await getAccessToken();
  const r = await fetch(`https://firebase.googleapis.com/v1alpha/projects/${projectId}/webApps`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  const d = await r.json().catch(() => ({}));
  const apps = d.apps || [];
  if (!apps.length) return null;
  const c = await fetch(`https://firebase.googleapis.com/v1alpha/${apps[0].name}/config`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  const cd = await c.json().catch(() => ({}));
  const value = { webApp: apps[0].name, apiKey: cd.apiKey || "", authDomain: cd.authDomain || `${projectId}.firebaseapp.com`, projectId };
  cachedWebConfig = { value, exp: now + 10 * 60 * 1000 };
  return value;
}

// Which actions need the proxy key (server-only operations)
const KEY_ACTIONS = new Set(["get", "list", "create", "update", "delete", "query", "setRules", "health"]);

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

    if (action === "whoami") {
      const claims = await verifyIdToken(req.idToken, projectId);
      return json(200, {
        uid: claims.user_id,
        email: claims.email || null,
        emailVerified: !!claims.email_verified,
        role: claims.role || null,
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
      return json(200, { ok: true, targetUid, role });
    }

    // ---------- key-gated actions ----------
    if (action === "health") return json(200, { ok: true, projectId });

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
        const r2 = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, { method: "PATCH", headers: { ...(await authz()), "Content-Type": "application/json" }, body: relBody });
        const d2 = await r2.json();
        return json(r2.status, { ruleset: rsName, release: d2 });
      }
      return json(200, { ruleset: rsName, release: d });
    }

    if (["get", "list", "create", "update", "delete", "query"].includes(action)) {
      if (!req.collection || !/^[A-Za-z0-9_\/ -]+$/.test(req.collection)) return json(400, { error: "bad collection path" });
      if (req.docId && !/^[A-Za-z0-9_-]+$/.test(req.docId)) return json(400, { error: "bad docId" });
      const dbId = encodeURIComponent(req.databaseId || "(default)");
      const apiV = req.apiVersion === "v1beta1" ? "v1beta1" : "v1";
      const base = `https://firestore.googleapis.com/${apiV}/projects/${projectId}/databases/${dbId}/documents/${encodeURIComponent(req.collection)}`;

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
