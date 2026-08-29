# Deploying, and handing over to the client

Two audiences. **Part 1 is for you**, once, at setup. **Part 2 is the page to
send the client** — it is deliberately short and has no jargon in it.

The end state: the client opens `yoursite.in/admin/`, logs in with their email
and password, edits the menu or a price, presses **Save**, and the website
updates about a minute later. No file manager, no copy-paste, no calling you —
and if they forget the password, "Forgot password?" emails them a reset link
without you either.

---

# Part 1 — setup (you, once)

## How saving works, in one paragraph

The site is static, so nothing in the browser can write a file. The client logs
in on `/admin/` through **Supabase** (which holds the one owner account), and
the page sends the edited menu — with the login token — to a small function on
Netlify (`netlify/functions/save.mjs`). That function verifies the token with
Supabase, requires it to be the owner's account, re-runs the same validation
the editor shows on screen, and commits `js/content.js` to GitHub. Netlify sees
the commit and redeploys. GitHub is therefore also the undo history: every
change the client makes is a commit you can revert. Each save is additionally
recorded in a Supabase table (`site_state`) with who saved and a link to the
commit. The live website never reads from Supabase — if the database is down,
only the admin login is affected.

## 1. Put the code on GitHub

There is no remote set up yet. Create an **empty** repository on GitHub —
private is fine, Netlify can read private repos — then:

```bash
cd /Users/amann/Dev-work/SwaadSe-Tiffin
git add -A
git commit -m "feat: admin saving, editable prices and contact details"
git remote add origin https://github.com/YOUR-NAME/swaadse-tiffin.git
git push -u origin master
```

> Note the branch is `master`, not `main`. Either is fine — just use the same
> name in `GITHUB_BRANCH` below. To rename it now:
> `git branch -M main` before pushing.

## 2. Connect Netlify

1. netlify.com → **Add new site** → **Import an existing project** → GitHub →
   pick the repo.
2. Leave the build command **empty** and the publish directory as `.`.
   `netlify.toml` already says this; there is nothing to compile.
3. Deploy. You get a `something-random.netlify.app` URL immediately.

## 3. Make the GitHub token

The function needs permission to commit that one file.

GitHub → **Settings** → **Developer settings** → **Personal access tokens** →
**Fine-grained tokens** → **Generate new token**:

| Field | Value |
|---|---|
| Repository access | **Only select repositories** → this repo alone |
| Permissions → Contents | **Read and write** |
| Everything else | leave alone |
| Expiration | your call — put a reminder in your calendar |

Copy the token. GitHub shows it once.

> Fine-grained, single-repo, contents-only is the point. If this token ever
> leaks, the worst case is edits to this one repository — not your whole account.

## 4. Set up Supabase (the login and the edit history)

Supabase's free tier does everything this needs: one owner account with proper
password hashing, login rate limiting, reset emails, and a small table of edit
history. About ten minutes:

1. supabase.com → **New project** (the free plan). Any strong database password
   — you will never type it again.
2. **SQL Editor** → paste the contents of `supabase/schema.sql` → **Run**. This
   creates the `site_state` history table, locked down so only a logged-in user
   can read or append, and nobody — not even with a leaked token — can rewrite
   old rows.
3. **Authentication → Users → Add user** → the client's email plus a first
   password (they can change it later with "Forgot password?"). Tick
   **Auto confirm user**.
4. **Authentication → Sign In / Up** → switch **Allow new users to sign up**
   OFF. One account exists; nobody else can create one. (The save function
   additionally refuses any account other than `ADMIN_EMAIL`, so even a
   re-enabled toggle grants nothing.)
5. **Authentication → URL Configuration** → set the Site URL to
   `https://your-site.netlify.app/admin/` (update it again when the real domain
   is connected). This is where the password-reset email sends the client.
6. **Authentication → Emails → SMTP Settings** → switch on **Enable custom
   SMTP** and point it at a real email provider. Do not skip this one.

   Supabase's built-in sender is meant for development: it is heavily
   rate-limited (a handful of messages an hour, shared across everyone), gives
   no delivery guarantee, and frequently lands in spam. The client only ever
   touches it through **"Forgot password?"** — which is exactly the moment they
   are locked out and least able to wait, and the moment you find out it did not
   arrive. Resend, Postmark, Brevo and Amazon SES all have free tiers large
   enough for a site with one account.

   Set the sender address to something on the business's own domain once DNS is
   connected, so the reset mail does not arrive from a stranger.
7. Optional but recommended: **SQL Editor** → seed the history with the current
   menu, so the table is never empty — the commented `insert` at the bottom of
   `schema.sql` shows how.
8. Copy two values from **Settings → API**: the **Project URL** and the
   **anon (public) key**. They go into Netlify next. (The anon key is public by
   design — every Supabase-backed site ships it to the browser. The
   `service_role` key on the same screen is a different matter: this project
   never uses it anywhere. Leave it alone.)

> **Free-tier note:** Supabase pauses free projects after about a week without
> traffic. `netlify/functions/ping.mjs` sends one request a day to prevent
> exactly that, so you should never see it — but if the login ever says it
> cannot reach the database, open the Supabase dashboard and press **Restore
> project**. Two minutes, nothing is lost. The live website is never affected;
> it does not read from the database.

## 5. Set the environment variables

Netlify → **Site configuration** → **Environment variables** → **Add a
variable**, for each:

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | the Project URL from step 4 | e.g. `https://abcdefgh.supabase.co` |
| `SUPABASE_ANON_KEY` | the anon (public) key from step 4 | |
| `ADMIN_EMAIL` | the client's login email | the only account allowed to save |
| `GITHUB_TOKEN` | the token from step 3 | |
| `GITHUB_REPO` | `YOUR-NAME/swaadse-tiffin` | owner slash repo, nothing else |
| `GITHUB_BRANCH` | `master` or `main` | must match what you pushed |

Then **Deploys → Trigger deploy → Clear cache and deploy site**, because
environment variables are only read at run time by a fresh deploy.

## 6. Check it before you hand it over

```
https://your-site.netlify.app/api/save
```

Should answer `{"ready":true,"missing":[],"supabase":{…}}`. If `ready` is
`false`, it names the variables still unset — that is the fastest way to debug
this.

Then, on `/admin/`:

- [ ] The panel shows a **login form**, **not** "copy the file and paste it in
      yourself". The second means the function is unreachable or half-configured.
- [ ] A wrong password is refused with a message under the form.
- [ ] Log in, empty a price → Save greys out and a red message appears.
- [ ] Change today's special, Save, and confirm a new commit appears on GitHub
      — and a new row in Supabase (**Table Editor → site_state**).
- [ ] Wait a minute, reload the site, see the change.
- [ ] Press "Forgot password?" and confirm the reset email arrives, is not in
      spam, and the link lands on `/admin/`. If it never comes, the cause is
      almost always step 4.6 — custom SMTP still switched off.
- [ ] On a phone (or a narrow window): edit something and check the dark
      **Unsaved changes** bar appears at the bottom.

## 7. Point the real domain at it

Netlify → **Domain management** → add `swaadsetiffin.in`, follow the DNS
instructions, and let Netlify issue the certificate. Update the **Site URL** in
Supabase (step 4.5) to the new domain at the same time, or password-reset
emails will keep pointing at the old address. Then do the sweep in README's
**Before you go live** checklist — the placeholder domain appears 15 times
across five files.

## Local development

`python3 -m http.server 4173` serves the site but has no `/api/save`, so
`/admin/` shows the copy-and-paste route. That is correct behaviour, not a bug.

To exercise the real login and Save button, install the Netlify CLI and run
`netlify dev` (serves on `http://localhost:8888`). It runs both functions the
way production does and reads the same settings from a `.env` in the project
root — so **the whole thing can be configured and tested locally, before the
site is ever deployed**:

```
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGci…
ADMIN_EMAIL=owner@example.com
GITHUB_TOKEN=github_pat_…
GITHUB_REPO=YOUR-NAME/swaadse-tiffin
GITHUB_BRANCH=master
```

`.env` is gitignored, and must stay that way — it holds a real GitHub token. It
is only needed before the site exists on Netlify; once step 2 is done, `netlify
link` followed by `netlify dev` pulls the same values from the site's own
environment variables and you can delete the local file.

Three things that catch people out:

- **The login form only appears once all five required variables are set.**
  `/admin/` calls `GET /api/save` first and falls back to copy-and-paste unless
  it answers `ready: true`, naming whatever is missing. To try the Supabase
  login on its own before the GitHub repo exists, put any non-empty placeholder
  in `GITHUB_TOKEN` and `GITHUB_REPO`: login, session expiry, validation and the
  error paths all exercise properly, and Save simply stops at "Could not save to
  GitHub" — having written nothing, anywhere.

- **A successful local Save is not a rehearsal.** There is no dry-run mode. It
  commits `js/content.js` to the real repository and appends a real row to the
  real `site_state` table, and if Netlify is already watching that branch, it
  publishes to the live site. While testing, point `GITHUB_BRANCH` at a
  throwaway branch — one that already exists, because the function commits to a
  branch but will not create one.

- **Password-reset emails link to the Site URL from step 4.5**, which is your
  production address, not localhost. To test resets locally, add
  `http://localhost:8888/admin/` under **Authentication → URL Configuration →
  Redirect URLs** in Supabase.

The daily Supabase ping does not fire under `netlify dev`. Run it by hand if you
want to watch it work: `netlify functions:invoke ping`.

## What is not covered by the login

`/admin/` itself is readable by anyone who guesses the URL. That is deliberate:
the page holds no secrets — not even the Supabase address, which it fetches
from `/api/save` — and cannot change anything without a verified login. What
someone could learn from it is the menu and the prices, which are already
public on the front page.

Two things to remember when the domain changes: update the **Site URL** in
Supabase (step 4.5), or password-reset emails will link to the old address; and
sessions last about an hour — the editor handles expiry by asking the client to
log in again without losing their edits.

---

# Part 2 — for the client

*Everything below can be copied into an email or a WhatsApp message.*

## Updating your website

Open **yoursite.in/admin/** on your phone or computer. You can change:

- **Today's special** — the line near the top of the website
- **This week's menu** — what you are cooking each day
- **Prices** — every price on the website
- **Phone numbers and address**
- **Delivery timings**

### How to make a change

1. Edit the boxes.
2. Look at the top of the page:
   - **Green tick** — all good.
   - **Orange message** — advice. You can still save.
   - **Red message** — something must be fixed. Saving stays switched off until
     you fix it, so you cannot break the website by accident.
3. Scroll to the bottom, **log in with your email and password**, and press
   **Save to the website**. (On a phone, the dark bar at the bottom of the
   screen also takes you there.)
4. Wait about a minute, then refresh your website. Your change is there.

### Useful to know

- **You cannot break it.** Anything that would break the website is refused
  before it saves.
- **One price changes everywhere.** Change the Deluxe Tiffin price once and it
  updates on the card *and* in the WhatsApp message customers send you. You
  never change the same price twice.
- **Undo all my changes** puts the boxes back to what is on the website now. It
  only works before you press Save.
- **Nothing is live until you press Save.** Typing in the boxes changes nothing.
- **Forgot your password?** Type your email in the login box, press **Forgot
  password?**, and follow the link in the email you get. You choose a new
  password yourself — nobody has to be called.
- **Keep your password private.** Anyone with it can change your menu and
  prices.

### If something goes wrong

- **"That email or password is not right"** — check for a capital letter or a
  space at the end. Still stuck? Use **Forgot password?**.
- **"Your login expired"** — you had the page open a long while. Log in again
  and press Save — your edits are still in the boxes.
- **"Could not reach the website"** — your internet dropped. Press Save again.
- **"Somebody else saved a moment ago"** — someone else was editing at the same
  time. Refresh the page and redo your change.
- **You saved but the website looks the same** — give it a full minute, then
  refresh. On a phone, close the tab and open it again.
- **Anything else** — call your developer. Every change is recorded and can be
  put back exactly as it was.
