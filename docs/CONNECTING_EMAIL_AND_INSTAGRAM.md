# Connecting real email and Instagram

Everything below is already built. What is missing is credentials — until they
exist, email and Instagram both run against the mock adapter, which invents
plausible-looking messages and never touches a real account.

Nothing here silently falls back. A capability with no credentials throws when
it is used, so a half-configured deploy cannot look like it is posting to
Instagram when it isn't.

---

## Part 1 — Connect your own mailbox (do this first)

This is the recommended route. Lensello signs in to the studio's existing email
account over IMAP and SMTP, so replies leave **from your real address**, thread
properly in the client's mail app, and their answer comes back to the inbox you
already watch. Five minutes, no approval, no DNS.

### 1. Turn on two-factor authentication

Your provider will not issue an app password without it.

### 2. Generate an app password

Not your normal password — a separate one, scoped to a single app.

| Provider | Where |
| --- | --- |
| Gmail | <https://myaccount.google.com/apppasswords> |
| Outlook / Hotmail | <https://account.microsoft.com/security> → Advanced security |
| iCloud | <https://account.apple.com> → Sign-In and Security → App-Specific Passwords |
| Yahoo | <https://login.yahoo.com/account/security> |

Copy it. Gmail shows it with spaces; paste it as-is, Lensello strips them.

### 3. Connect it

Open **Connections** → **Studio mailbox**. Enter the address, a display name,
and the app password. For Gmail, Outlook, iCloud, Yahoo, Zoho, and Fastmail the
server settings fill themselves in; anything else, open **Server settings** and
enter the IMAP and SMTP hosts your provider publishes.

Connecting tests both directions before saving anything, so if it succeeds,
sending and reading both work.

### What Lensello can do with it

The app password grants access to that whole mailbox — it is broader than an
OAuth scope would be. It is stored encrypted with AES-256-GCM in a table with
row-level security enabled and **no policies at all**, so no user session can
read it; the decryption key is a separate secret held in the environment, so a
leaked database key alone is not enough to use it. Disconnecting deletes it.

If that trade-off is not one you want, revoke the app password at your provider
at any time — it takes effect immediately and affects nothing else on the
account.

---

## Alternative — Postmark

Only worth it if you would rather Lensello never hold a mailbox credential, or
you want a dedicated sending address separate from your own. Replies then come
from that address instead of yours and start a new thread rather than
continuing the client's.

### 1. Create a Postmark account

<https://postmarkapp.com> — the free tier covers 100 emails/month, which is
plenty for reply drafts and alerts while you try it.

### 2. Verify a sender signature

Sender Signatures → Add. Use the address replies should come *from*, e.g.
`hello@yourstudio.com`. Postmark emails a confirmation link.

For better deliverability, add the DKIM and Return-Path DNS records Postmark
shows you. Skippable at first; do it before real client volume.

### 3. Get the server token

Servers → your server → **API Tokens** → copy the **Server API token**.
This is a credential. It is not the Account token.

### 4. Set up inbound

Servers → your server → **Inbound** stream → **Settings**.

1. Copy the **inbound email address** Postmark generates (a long
   `…@inbound.postmarkapp.com`).
2. Set the **Inbound webhook URL** to:

   ```
   https://lensello-web-kappa.vercel.app/api/webhooks/postmark-inbound?secret=YOUR_WEBHOOK_SECRET
   ```

   Pick `YOUR_WEBHOOK_SECRET` yourself — a long random string. Postmark does
   not sign inbound webhooks, so this secret in the URL *is* the
   authentication. Treat the whole URL as a password: do not paste it into a
   ticket, a screenshot, or a chat.

3. In your studio email (Gmail, Outlook, wherever), set up **forwarding** to
   that inbound address. Gmail: Settings → Forwarding → Add a forwarding
   address, then confirm.

### 5. Add the environment variables

Vercel → the `lensello-web` project → Settings → Environment Variables, all on
**Production**:

| Name | Value |
| --- | --- |
| `POSTMARK_SERVER_TOKEN` | the Server API token from step 3 |
| `POSTMARK_WEBHOOK_SECRET` | the random string you chose in step 4 |
| `LENSELLO_FROM_EMAIL` | the verified sender from step 2 |
| `LENSELLO_INTEGRATION_MODE` | change from `mock` to `live` |
| `LENSELLO_NOTIFY_EMAIL` | *(optional)* where alerts go. Defaults to every owner account. |

Redeploy after changing these — environment variables only apply to new
deployments.

### 6. Check it

Send an email to your studio address from your phone. Within a few seconds it
should appear in **Clients**, with the sender created as a lead if they are
new, and you should get an alert email.

If nothing arrives, Postmark's **Activity** tab shows whether the message
reached them and what the webhook returned. A 401 means the secret in the URL
does not match `POSTMARK_WEBHOOK_SECRET`. A 503 means the variable is not set
on the deployment.

---

## Part 2 — Instagram (start now, finishes in weeks)

The waiting is Meta's App Review. Start it early and it runs in the background.

> **The adapter for this is written but unverified.** It has never run against
> Meta's API, because that needs the credentials this section produces. Expect
> to fix things the first time it runs — treat the first connection as a test,
> not a launch.

### 1. Instagram must be a Professional account linked to a Page

Instagram app → Settings → Account type → switch to **Business** or
**Creator**, then link it to a Facebook Page (create one if the studio has
none). There is no API path to a personal Instagram account; everything goes
through the Page.

### 2. Create a Meta app

<https://developers.facebook.com/apps> → Create App → type **Business**.
Add the **Instagram Graph API** and **Facebook Login** products.

### 3. Set the redirect URI

Facebook Login → Settings → **Valid OAuth Redirect URIs**:

```
https://lensello-web-kappa.vercel.app/connections/callback/instagram
```

It must match exactly — Meta rejects anything else, including a trailing slash.

### 4. Add the environment variables

| Name | Value |
| --- | --- |
| `META_APP_ID` | App ID from the app dashboard |
| `META_APP_SECRET` | App Secret from Settings → Basic |
| `META_IG_USER_ID` | the Instagram business account id, shown on the Connections page after the first successful link |

### 5. Submit for App Review

Under App Review → Permissions and Features, request:

- `instagram_basic`
- `instagram_content_publish` — posting
- `instagram_manage_messages` — reading DMs
- `pages_show_list`, `pages_read_engagement`

Meta requires a screencast showing each permission in use, and a privacy policy
URL. This is the slow part; expect weeks and at least one rejection.

Before approval you can still connect and test as a developer/admin of the app
— Meta grants your own accounts the permissions in development mode. The
Connections page reads capabilities from what was *actually* granted, so a
partly-approved app shows up honestly rather than pretending it can post.

---

## What runs against what

| Capability | Without credentials | With them |
| --- | --- | --- |
| Client email in/out | mock inquiries | real mail via Postmark |
| Alerts | none | email on new inquiry |
| Instagram publish | simulated | real, after review |
| Instagram DMs | invented | real, after review |
| Facebook / TikTok / Pinterest | simulated | **still no live adapter** |
| Ads, calendar, payments | simulated | **still no live adapter** |

Setting `LENSELLO_INTEGRATION_MODE=live` does not make everything live. It
means "stop pretending": anything without a real adapter now throws instead of
returning invented data. Only Postmark and Instagram have live adapters today.
