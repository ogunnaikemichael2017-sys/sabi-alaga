# Email + password reset (ZeptoMail, no Firebase links)

What this PR adds:

- netlify/functions/reset.js: takes an email from forgot-password.html,
  mints a one-hour single-use token, stores only its SHA-256 hash in the
  Firestore collection passwordResetTokens, and sends the ZeptoMail
  reset template (sabi-team-reset-v1) with a link to our own page.
- netlify/functions/reset-confirm.js: verifies the token and sets the
  new password with Firebase Admin, then signs out old sessions.
- public/forgot-password.html: "forgot password" page.
- public/reset-password.html: the dedicated reset page the email opens.
- docs/zepto-templates.md: the two ZeptoMail templates to create
  (sabi-team-invite-v1, sabi-team-reset-v1) with merge variables.

No Firebase password-reset link is ever generated or emailed.

Env vars used: ZEPTO_API_KEY, ZEPTO_API_HOST, ZEPTO_AGENT_ALIAS,
ZEPTO_INVITE_TEMPLATE_KEY, ZEPTO_RESET_TEMPLATE_KEY, SENDER_EMAIL,
APP_URL, FIREBASE_SERVICE_ACCOUNT_JSON (all already set on Netlify,
template keys marked secret).

The invite email (team members, temporary password) is sent by the same
ZeptoMail setup; its sender function is added with the admin dashboard PR.
