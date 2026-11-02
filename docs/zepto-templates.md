# ZeptoMail templates for Sabi Alaga

Two templates to create inside ZeptoMail (Zoho CPaaS). Create each one with the
"Source" (HTML) editor, NOT the visual editor, so the code stays code. Set the
merge variables exactly as written, with no spaces inside the braces.

## 1. sabi-team-invite-v1  (team member invitation)
Merge variables: {{first_name}} · {{role}} · {{temp_password}} · {{login_url}}

**Plain-English body**

Subject: You have been invited to the Sabi Alaga dashboard

Hello {{first_name}},

You have been invited to join the Sabi Alaga team as {{role}}.

Your sign-in details:
Email: the address this email was sent to
Temporary password: {{temp_password}}

Sign in here: {{login_url}}

For security, please change this temporary password the first time you sign in.
If you were not expecting this invitation, you can ignore this email.

Warm regards,
The Sabi Alaga Team

**HTML skeleton** (style it to taste: maroon #5c1a2e, gold #c9a227)

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:24px 0;font-family:Georgia,serif;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e0d4;border-radius:12px;padding:32px;">
      <tr><td style="color:#5c1a2e;font-size:22px;padding-bottom:8px;">You have been invited to the Sabi Alaga dashboard</td></tr>
      <tr><td style="color:#5c5347;font-size:15px;line-height:1.6;padding-bottom:16px;">Hello {{first_name}},</td></tr>
      <tr><td style="color:#5c5347;font-size:15px;line-height:1.6;padding-bottom:16px;">You have been invited to join the Sabi Alaga team as <strong>{{role}}</strong>.</td></tr>
      <tr><td style="background:#faf7f2;border:1px solid #e8e0d4;border-radius:8px;padding:16px;color:#5c5347;font-size:15px;line-height:1.8;">
        Email: <strong>the address this email was sent to</strong><br/>
        Temporary password: <strong style="font-family:monospace;">{{temp_password}}</strong>
      </td></tr>
      <tr><td align="center" style="padding:24px 0;">
        <a href="{{login_url}}" style="background:#5c1a2e;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:15px;display:inline-block;">Sign in to your account</a>
      </td></tr>
      <tr><td style="color:#7a6f63;font-size:13px;line-height:1.6;padding-bottom:8px;">For security, please change this temporary password the first time you sign in.</td></tr>
      <tr><td style="color:#7a6f63;font-size:13px;line-height:1.6;">If you were not expecting this invitation, you can ignore this email.</td></tr>
    </table>
  </td></tr>
</table>
```

## 2. sabi-team-reset-v1  (password reset, our own page)
Merge variables: {{first_name}} · {{reset_link}} · {{login_url}}

The link now opens OUR OWN reset page on the website
(www.sabialaga.name.ng/reset-password.html). No Firebase link is ever emailed.

**Plain-English body**

Subject: Reset your Sabi Alaga password

Hello {{first_name}},

We received a request to reset the password for your Sabi Alaga account.

Set a new password here: {{reset_link}}

This link works for one hour and can be used once.
If you did not ask for this, your password is still safe and you can ignore this email.

Sign in afterwards: {{login_url}}

Warm regards,
The Sabi Alaga Team

**HTML skeleton**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:24px 0;font-family:Georgia,serif;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e0d4;border-radius:12px;padding:32px;">
      <tr><td style="color:#5c1a2e;font-size:22px;padding-bottom:8px;">Reset your Sabi Alaga password</td></tr>
      <tr><td style="color:#5c5347;font-size:15px;line-height:1.6;padding-bottom:16px;">Hello {{first_name}},</td></tr>
      <tr><td style="color:#5c5347;font-size:15px;line-height:1.6;padding-bottom:16px;">We received a request to reset the password for your Sabi Alaga account.</td></tr>
      <tr><td align="center" style="padding:0 0 16px;">
        <a href="{{reset_link}}" style="background:#5c1a2e;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:15px;display:inline-block;">Set a new password</a>
      </td></tr>
      <tr><td style="color:#7a6f63;font-size:13px;line-height:1.6;padding-bottom:8px;">This link works for one hour and can be used once.</td></tr>
      <tr><td style="color:#7a6f63;font-size:13px;line-height:1.6;padding-bottom:8px;">If you did not ask for this, your password is still safe and you can ignore this email.</td></tr>
      <tr><td style="color:#7a6f63;font-size:13px;line-height:1.6;">Sign in afterwards: <a href="{{login_url}}" style="color:#5c1a2e;">{{login_url}}</a></td></tr>
    </table>
  </td></tr>
</table>
```

## After creating each template in Zepto

Copy each template's key (it looks like
2d6f.xxxx.k1.xxxx.xxxx) and put it in Netlify as:

- ZEPTO_INVITE_TEMPLATE_KEY  (invite template)
- ZEPTO_RESET_TEMPLATE_KEY   (reset template)

Both are already added on Netlify and marked as secret values.

## How the reset flow works now (no Firebase link)

1. A person opens forgot-password.html and enters their email.
2. It calls the reset function, which checks the account exists,
   mints a one-hour, single-use token, and stores only the token's
   SHA-256 hash in a Firestore collection called passwordResetTokens.
3. ZeptoMail sends sabi-team-reset-v1 with {{reset_link}} pointing at
   /reset-password.html?token=...
4. The person sets a new password on our own page, which calls the
   reset-confirm function. It checks the hash, the expiry and the
   used flag, then updates the password with Firebase Admin and
   signs out old sessions.

Files: reset.js (sends the email), reset-confirm.js (completes the reset),
forgot-password.html (ask for a reset), reset-password.html (set the new
password). ZeptoMail sandbox does not deliver; test with the live agent.
