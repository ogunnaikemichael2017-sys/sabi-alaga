// netlify/functions/reset.js
// Sends the password-reset email through ZeptoMail. NO Firebase link is ever
// generated or emailed: we mint our own one-hour token, store only its SHA-256
// hash in Firestore, and email a link to OUR OWN page (/reset-password.html).
//
// Env vars used: ZEPTO_API_KEY, ZEPTO_API_HOST, ZEPTO_AGENT_ALIAS,
// ZEPTO_RESET_TEMPLATE_KEY, SENDER_EMAIL, APP_URL, FIREBASE_SERVICE_ACCOUNT_JSON

const crypto = require("crypto");
const firebaseAdmin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

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

async function sendResetEmail({ to, resetLink, firstName }) {
  const host = process.env.ZEPTO_API_HOST || "api.zeptomail.com";
  const alias = process.env.ZEPTO_AGENT_ALIAS || "";
  const url = `https://${host}/v1.1/email/template`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-enczapikey ${process.env.ZEPTO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_key: process.env.ZEPTO_RESET_TEMPLATE_KEY,
      from: { address: process.env.SENDER_EMAIL, name: "Sabi Alaga" },
      to: [{ email_address: { address: to } }],
      merge_info: {
        first_name: firstName || "there",
        reset_link: resetLink,
        login_url: `${process.env.APP_URL}/`,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ZeptoMail ${res.status}: ${text.slice(0, 300)}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body || "{}"));
  } catch {
    return json(400, { error: "Invalid request" });
  }
  email = (email || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(400, { error: "A valid email is required" });
  }

  try {
    const admin = getAdmin();
    const auth = admin.auth();

    // Same reply whether or not the account exists, so nobody can probe
    // which emails have accounts.
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (e) {
      if (e && e.code === "auth/user-not-found") {
        return json(200, { ok: true, message: "If that email has an account, a reset link is on its way." });
      }
      throw e;
    }

    // One-hour, single-use token. Only its hash is stored.
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000;

    const db = getFirestore();
    await db.collection("passwordResetTokens").doc(tokenHash).set({
      uid: user.uid,
      email,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    });

    const resetLink = `${process.env.APP_URL}/reset-password.html?token=${encodeURIComponent(token)}`;
    const firstName = (user.displayName || "").split(" ")[0] || "there";
    await sendResetEmail({ to: email, resetLink, firstName });

    return json(200, { ok: true, message: "If that email has an account, a reset link is on its way." });
  } catch (err) {
    console.error("reset failed:", err);
    return json(500, { error: "Could not send the reset email right now. Please try again." });
  }
};
