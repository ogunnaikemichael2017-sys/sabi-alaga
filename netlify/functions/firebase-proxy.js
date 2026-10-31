// Firestore proxy for The Sabi Alaga.
// Auth: requests must carry header "x-proxy-key" matching SABI_PROXY_KEY.
// Reads the Firebase service account from FIREBASE_SERVICE_JSON, signs a JWT,
// and proxies read/write calls to Firestore. No secrets ever reach the client.

const crypto = require("crypto");

let cachedToken = null; // { token, exp }

function svc() {
  const raw = process.env.FIREBASE_SERVICE_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_JSON is not set");
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
  if (!res.ok) {
    throw new Error(`token endpoint ${res.status}: ${JSON.stringify(data)}`);
  }
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

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
    if (Array.isArray(v)) {
      return { arrayValue: { values: v.map(toFirestore) } };
    }
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
// helper used for arrays
fromFirestore.__x = null;
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
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const key = process.env.SABI_PROXY_KEY;
  if (!key) return json(500, { error: "SABI_PROXY_KEY is not set" });
  const given = event.headers["x-proxy-key"] || event.headers["X-Proxy-Key"];
  const eq = (a, b) =>
    crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());
  if (!given || !eq(given, key)) {
    return json(401, { error: "unauthorized" });
  }

  let req;
  try {
    req = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "invalid JSON body" });
  }
  const { action, collection, docId, data, pageSize, pageToken, orderBy, where, mask, max } = req;
  if (!action) return json(400, { error: "action is required" });
  const isDiag = action === "databases" || action === "projects" || action === "collections" || action === "deleteDatabase" || action === "createDatabase" || action === "setRules" || action === "apiKeyTest";
  if (!isDiag) {
    if (!collection) return json(400, { error: "action and collection are required" });
    if (!/^[A-Za-z0-9_\/ -]+$/.test(collection)) return json(400, { error: "bad collection path" });
    if (docId && !/^[A-Za-z0-9_-]+$/.test(docId)) return json(400, { error: "bad docId" });
  }

  let sa;
  try { sa = svc(); } catch (e) {
    return json(500, { error: e.message });
  }
  const dbId = encodeURIComponent(req.databaseId || "(default)");
  const apiV = req.apiVersion === "v1beta1" ? "v1beta1" : "v1";
  const base = `https://firestore.googleapis.com/${apiV}/projects/${sa.project_id}/databases/${dbId}/documents/${encodeURIComponent(collection)}`;
  const authz = () => getAccessToken().then((t) => ({ Authorization: `Bearer ${t}`, "X-Goog-User-Project": sa.project_id }));

  try {
    if (action === "get") {
      if (!docId) return json(400, { error: "docId required for get" });
      const r = await fetch(`${base}/${docId}`, { headers: await authz() });
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
      if (pageSize) u.searchParams.set("pageSize", String(Math.min(pageSize, 300)));
      if (pageToken) u.searchParams.set("pageToken", pageToken);
      if (orderBy) u.searchParams.set("orderBy", orderBy);
      if (mask) u.searchParams.set("mask.fieldPaths", mask);
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
      for (const k of Object.keys(data || {})) fields[k] = toFirestore(data[k]);
      const url = new URL(base);
      if (docId) {
        url.searchParams.set("documentId", docId);
      }
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
      if (!docId) return json(400, { error: "docId required for update" });
      const fields = {};
      for (const k of Object.keys(data || {})) fields[k] = toFirestore(data[k]);
      const paths = Object.keys(fields);
      const u = new URL(`${base}/${docId}`);
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
      if (!docId) return json(400, { error: "docId required for delete" });
      const r = await fetch(`${base}/${docId}`, { method: "DELETE", headers: await authz() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json(r.status, d);
      return json(200, { ok: true });
    }

    if (action === "query") {
      const structuredQuery = { from: [{ collectionId: collection.split("/").pop(), allDescendants: collection.includes("/") }] };
      if (where && Array.isArray(where)) {
        structuredQuery.where = { fieldFilter: { field: { fieldPath: where[0] }, op: where[1], value: toFirestore(where[2]) } };
      }
      if (orderBy) {
        const [fieldPath, dir] = Array.isArray(orderBy) ? orderBy : [orderBy, "ASCENDING"];
        structuredQuery.orderBy = [{ field: { fieldPath }, direction: dir || "ASCENDING" }];
      }
      if (max) structuredQuery.limit = Math.min(max, 300);
      const proj = sa.project_id;
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents:runQuery`, {
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

    if (action === "collections") {
      const r = await fetch(`https://firestore.googleapis.com/${apiV}/projects/${sa.project_id}/databases/${encodeURIComponent(req.databaseId || "(default)")}/documents:listCollectionIds`, { method: "POST", headers: await authz(), body: "{}" });
      const d = await r.json();
      return json(r.status, d);
    }
    if (action === "databases") {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases`, { headers: await authz() });
      const d = await r.json();
      return json(r.status, d);
    }
    if (action === "deleteDatabase") {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/${encodeURIComponent(req.databaseId || "default")}`, { method: "DELETE", headers: await authz() });
      const d = await r.json();
      return json(r.status, d);
    }
    if (action === "createDatabase") {
      const dbId = req.databaseId || "default";
      const body = { type: "FIRESTORE_NATIVE", locationId: req.locationId || "europe-west1", databaseEdition: "STANDARD" };
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases?databaseId=${encodeURIComponent(dbId)}`, { method: "POST", headers: { ...(await authz()), "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      return json(r.status, d);
    }
    if (action === "setRules") {
      const rules = (req.rules || "").trim();
      if (!rules) return json(400, { error: "rules content is required" });
      let r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${sa.project_id}/rulesets`, { method: "POST", headers: { ...(await authz()), "Content-Type": "application/json" }, body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: rules }] } }) });
      let d = await r.json();
      if (!r.ok) return json(r.status, d);
      const rsName = d.name;
      const relBody = JSON.stringify({ name: `projects/${sa.project_id}/releases/cloud.firestore`, rulesetName: rsName });
      r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${sa.project_id}/releases`, { method: "POST", headers: { ...(await authz()), "Content-Type": "application/json" }, body: relBody });
      d = await r.json();
      if (!r.ok) {
        const r2 = await fetch(`https://firebaserules.googleapis.com/v1/projects/${sa.project_id}/releases/cloud.firestore`, { method: "PATCH", headers: { ...(await authz()), "Content-Type": "application/json" }, body: relBody });
        const d2 = await r2.json();
        return json(r2.status, { ruleset: rsName, release: d2 });
      }
      return json(200, { ruleset: rsName, release: d });
    }
    if (action === "apiKeyTest") {
      const lr = await fetch(`https://apikeys.googleapis.com/v2/projects/${sa.project_id}/keys`, { headers: await authz() });
      const lt = await lr.text();
      let ld;
      try { ld = JSON.parse(lt); } catch (e) { return json(200, { apikeysStatus: lr.status, apikeysBodyStart: lt.slice(0, 300) }); }
      const keys = ((ld.keys || [])).map((k) => k.name);
      const out = { apikeysStatus: lr.status, keyCount: keys.length, firestoreStatus: null, firestoreBody: null };
      if (keys.length) {
        const kr = await fetch(`https://apikeys.googleapis.com/v2/${keys[0]}:getKeyString`, { method: "POST", headers: { ...(await authz()), "Content-Type": "application/json" }, body: "{}" });
        const kt = await kr.text();
        let kd;
        try { kd = JSON.parse(kt); } catch (e) { return json(200, { getKeyStringStatus: kr.status, getKeyStringBodyStart: kt.slice(0, 300) }); }
        const keyString = kd.keyString || "";
        const fr = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/orders?key=${encodeURIComponent(keyString)}`);
        out.firestoreStatus = fr.status;
        const fd = await fr.json();
        out.firestoreBody = fd.error ? { code: fd.error.code, message: fd.error.message, status: fd.error.status } : fd;
      } else {
        out.keysListError = ld;
      }
      return json(200, out);
    }
    if (action === "projects") {
      const r = await fetch("https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=100", { headers: await authz() });
      const d = await r.json();
      return json(r.status, d);
    }

    return json(400, { error: `unknown action: ${action}` });
  } catch (e) {
    return json(502, { error: e.message || "proxy error" });
  }
};
