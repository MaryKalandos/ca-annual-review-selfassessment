# Annual Self-Reflection Form — Chiropractic Assistant (Part A)

A clean, modern, mobile-friendly self-assessment form for annual performance reviews. When the employee submits, the responses are emailed to management using the [Resend](https://resend.com) email API.

This project is built for **Cloudflare Pages** — no Node server to host, no `npm install`, no `package.json`. Cloudflare runs the form's HTML as a static page and runs the email logic as a serverless Pages Function.

---

## Project Structure

```
chiro-review-form/
├── index.html               The styled form (static page, served by Cloudflare)
├── functions/
│   └── api/
│       └── submit.js        Cloudflare Pages Function — handles POST /api/submit
└── README.md
```

That's it. Three files. No dependencies to install.

---

## 1. One-time Setup

### A. Get a Resend API key
1. Sign up at <https://resend.com> (free tier is plenty for review submissions).
2. Go to **API Keys** → **Create API Key**. Copy the key (starts with `re_`).
3. For the initial test, you can use Resend's shared sender — `onboarding@resend.dev` — but Resend will only deliver those messages to the address that owns the Resend account. To send to anyone else (including `mary@wellbeing365.com.au`), you'll need to verify a domain (see section 4).

### B. Create the Cloudflare Pages project
1. Sign in at <https://dash.cloudflare.com>. If you don't have an account, sign up — it's free.
2. Go to **Workers & Pages** → **Create** → **Pages** → **Upload assets** (simplest), or **Connect to Git** if the code lives in GitHub / GitLab.
3. **Upload assets path:** drop in this whole folder (the one containing `index.html` and `functions/`).
4. **Project name:** something like `wellbeing-review` — this becomes part of the URL (`wellbeing-review.pages.dev`).
5. Click **Deploy site**.

> If you chose the Git option instead: leave the **Build command** blank and set the **Build output directory** to `/` (the project root). Cloudflare automatically detects the `functions/` folder and turns each file into a serverless function.

### C. Add the Resend API key as an environment variable
1. In your Cloudflare Pages project → **Settings** → **Environment variables**.
2. Under **Production**, click **Add variable**:
   - **Variable name:** `RESEND_API_KEY`
   - **Value:** your Resend key (the `re_…` one)
   - Tick **Encrypt** so the value is stored as a secret.
3. Save. Then go to **Deployments** → click the latest deployment → **Retry deployment** so the function picks up the new variable.

You can also add the same variable under **Preview** if you want preview deployments to send real emails.

---

## 2. Testing

### Local preview (no email sending)
You can open `index.html` directly in any browser to check the visual design — submissions won't go anywhere because there's no local function runtime.

### Local preview with the function (optional, requires Node + Wrangler)
If you want to test the email flow end-to-end on your own machine before deploying:

```bash
npx wrangler pages dev .
```

Then open <http://localhost:8788>. Wrangler reads environment variables from a local `.dev.vars` file:

```
RESEND_API_KEY=re_your_real_key_here
```

(That file should not be committed to Git.)

### Live test
Open your deployed URL (e.g. `https://wellbeing-review.pages.dev`) and submit the form once with real content. The submission will land in `mary@wellbeing365.com.au`'s inbox.

---

## 3. How the Pages Function Works

The form posts JSON to `/api/submit`. Cloudflare automatically routes that to `functions/api/submit.js` and runs the function at the edge.

The function:
1. Parses the JSON body.
2. Validates all required fields.
3. Reads `RESEND_API_KEY` from the Cloudflare environment.
4. Calls the Resend REST API (`POST https://api.resend.com/emails`) directly with `fetch` — no Node SDK, no npm packages.
5. Escapes every piece of user input before placing it into the email HTML, so a submission containing `<script>` or similar is rendered as plain text rather than executed in the recipient's mail client.
6. Returns `{ ok: true }` on success, or `{ error: "…" }` with an appropriate HTTP status on failure.

The existing `index.html` already expects exactly that shape, so no front-end change is needed.

---

## 4. Switching to a Custom Sender (`reviews@wellbeing365.com.au`)

Right now the function sends from:

```
Wellbeing Reviews <onboarding@resend.dev>
```

To switch to your real clinic address:

1. In Resend, go to **Domains** → **Add Domain** → enter `wellbeing365.com.au`.
2. Resend will show you a small set of DNS records (SPF, DKIM, sometimes DMARC). Add them in your domain registrar's DNS settings (GoDaddy, Crazy Domains, Cloudflare DNS, etc.).
3. Wait until the domain shows **Verified** ✅ in Resend (usually a few minutes; can be up to 24 hours).
4. Open `functions/api/submit.js` and change the `FROM_EMAIL` constant near the top from:

   ```js
   const FROM_EMAIL = 'Wellbeing Reviews <onboarding@resend.dev>';
   ```

   to:

   ```js
   const FROM_EMAIL = 'Wellbeing Reviews <reviews@wellbeing365.com.au>';
   ```

5. Redeploy on Cloudflare Pages (drag-and-drop a new upload, or push the change to Git).

---

## 5. Changing Recipient Emails Later

The recipient lives in `functions/api/submit.js` as the `MANAGEMENT_EMAILS` array near the top of the file:

```js
const MANAGEMENT_EMAILS = ['mary@wellbeing365.com.au'];
```

To add or change recipients, edit that array and redeploy:

```js
const MANAGEMENT_EMAILS = [
  'mary@wellbeing365.com.au',
  'manager@wellbeing365.com.au',
];
```

---

## 6. Customising the Look

### Logo
The form ships with a typographic "Wellbeing Chiropractic" wordmark in the sage palette. To use a real logo file instead:

1. Save your logo as `logo.svg`, `logo.png`, or `logo.jpg`.
2. Drop it into the **project root** (next to `index.html`).
3. Redeploy. The page automatically picks up `/logo.svg`, then `/logo.png`, then `/logo.jpg`.

### Colours
The palette lives at the top of `index.html` inside the `:root { ... }` block. Change a few hex codes and the whole form re-skins:

```css
--accent:      #7C9D88;   /* sage green — primary brand colour */
--accent-soft: #E8F0EB;   /* soft tint behind icons */
--bg:          #F6F4EF;   /* page background */
```

---

## 7. Building Part B (Manager Review) Later

Cloudflare Pages will turn any file you drop into `functions/` into a serverless route automatically. To add the manager review:

- Add `manager-review.html` next to `index.html`.
- Add `functions/api/submit-manager.js` — copy `submit.js` and tweak the questions / subject.
- The Resend setup and environment variable are already shared.

---

## 8. Security & Privacy Notes

- Cloudflare Pages serves the site over HTTPS automatically — no SSL setup needed.
- The Resend API key lives only in Cloudflare's encrypted environment variables; it is never sent to the browser.
- The function validates required fields on the server side (the form also validates in the browser).
- Every piece of user-submitted content is HTML-escaped before being inserted into the outgoing email.
- There is no database — submissions exist only in the email Resend sends.
- For full HR compliance, check that your data-handling matches your country's privacy rules (e.g., the Australian Privacy Principles).

---

## 9. Troubleshooting

| Issue | Fix |
|---|---|
| Form submits but no email arrives | Check Cloudflare → your project → **Functions** → **Logs**. Most often the API key is missing/typo'd, or the sender domain isn't verified yet in Resend. |
| "Email service is not configured" | The `RESEND_API_KEY` variable hasn't been set on the Production environment, or the deployment was made before the variable was added. Re-deploy after adding it. |
| Resend says "Domain not verified" | You're still on `onboarding@resend.dev` and trying to send to an address that isn't your Resend account owner. Either verify `wellbeing365.com.au` and switch the sender (section 4), or test with the Resend account owner's email. |
| Form looks broken on a phone | Hard-refresh the browser. The CSS is mobile-first and works in Safari, Chrome, Firefox, and Edge. |

---

## Quick Reference

```text
Front end:      index.html         (static, served by Cloudflare Pages)
Backend route:  /api/submit  ->    functions/api/submit.js (Cloudflare Function)
Env var:        RESEND_API_KEY     (Cloudflare → Settings → Environment variables)
Recipient:      mary@wellbeing365.com.au   (edit in submit.js)
Sender:         Wellbeing Reviews <onboarding@resend.dev>
                (change to reviews@wellbeing365.com.au once domain is verified)
```
