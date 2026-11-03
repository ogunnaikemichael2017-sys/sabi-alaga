// netlify/functions/reset-confirm.js
// Completes the password reset on OUR OWN page. Verifies the token we minted
// in reset.js, then sets the new password with Firebase Admin. No Firebase
// reset link is ever involved.
//
// Env vars used: FIREBASE_SERVICE_ACCOUNT_JSON

const crypto = require("crypto");
const firebaseAdmin = require("firebase-admin");

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

let initialized = false;
function getAdmin() {
  if (initialized) return firebaseAdmin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  const creds = JSON.parse(raw);
  if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(creds) });
  }
  initialized = true;
  return firebaseAdmin;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let token, password;
  try {
    ({ token, password } = JSON.parse(event.body || "{}"));
  } catch {
    return json(400, { error: "Invalid request" });
  }

  if (!token) return json(400, { error: "This reset link is not valid." });
  if (!password || password.length < 8) {
    return json(400, { error: "New password must be at least 8 characters." });
  }

  try {
    const admin = getAdmin();
    const db = admin.firestore();

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const docRef = db.collection("passwordResetTokens").doc(tokenHash);
    const doc = await docRef.get();

    if (!doc.exists) {
      return json(400, { error: "This reset link is not valid or has already been used." });
    }
    const data = doc.data();
    if (data.used) {
      return json(400, { error: "This reset link has already been used. Please request a new one." });
    }
    if (!data.expiresAt || Date.now() > data.expiresAt) {
      return json(400, { error: "This reset link has expired. Please request a new one." });
    }

    // Set the new password directly. Also revoke existing sessions so any
    // device signed in with the old password is signed out.
    await admin.auth().updateUser(data.uid, { password });
    try {
      await admin.auth().revokeRefreshTokens(data.uid);
    } catch (e) {
      // Non-fatal: password is already changed.
    }

    await docRef.update({ used: true, usedAt: Date.now() });

    // A password the user chose themselves means the temporary invite
    // password is gone: clear the mustChangePassword flag (keep the role)
    // and mark the team member Active so the admin team list reflects it.
    try {
      const u = await admin.auth().getUser(data.uid);
      const claims = { ...(u.customClaims || {}) };
      if (claims.mustChangePassword) {
        delete claims.mustChangePassword;
        await admin.auth().setCustomUserClaims(data.uid, claims);
      }
    } catch (e) {
      console.error("reset-confirm: could not clear mustChangePassword:", (e && e.message) || e);
    }
    try {
      const tRef = db.collection("team").doc(data.uid);
      const tDoc = await tRef.get();
      if (tDoc.exists && tDoc.data().status && tDoc.data().status !== "Active") {
        await tRef.update({ status: "Active", activatedAt: new Date().toISOString() });
      }
    } catch (e) {
      console.error("reset-confirm: could not update team status:", (e && e.message) || e);
    }

    return json(200, { ok: true, message: "Your password has been updated. You can sign in now." });
  } catch (err) {
    console.error("reset-confirm failed:", err);
    return json(500, { error: "Could not update the password right now. Please try again." });
  }
};
