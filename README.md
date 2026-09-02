# SolarFix Inventory & Repair Manager

A responsive inventory + repair tracker for a solar shop, with three staff
roles (Worker, Secretary, Admin), live multi-device sync, and a daily report
with charts you can print or save as a PDF to send to the boss.

- **Frontend:** plain HTML/CSS/JS (no build step) — hosted free on GitHub Pages
- **Backend:** Supabase (Postgres database + login accounts + permissions)

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New project**
2. Pick a name (e.g. `solarfix`), a database password (save it somewhere safe), and a region close to you
3. Wait ~2 minutes for it to finish setting up

## 2. Create the database tables

1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**
2. Open `sql/schema.sql` from this project, copy all of it, paste it in, and click **Run**
3. You should see "Success. No rows returned" — this created all 5 tables and the permission rules

## 3. Turn off "confirm email" (recommended for a small shop)

By default Supabase makes new accounts confirm their email before they can log in — extra friction for a shop where you're setting up accounts for staff directly.

1. **Authentication** → **Providers** → **Email**
2. Turn **off** "Confirm email"
3. Save

*(If you'd rather keep email confirmation on, that's fine too — staff will just need to click a confirmation link in their email the first time.)*

## 4. Connect the frontend to your project

1. In Supabase: **Project Settings** → **API**
2. Copy the **Project URL** and the **anon public** key
3. Open `js/supabase-client.js` in this project and paste them in:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```
   These two values are safe to be public — they're meant to be used from a browser. The real protection is the permission rules from step 2.

## 5. Deploy the "add staff" function

Creating a *login for someone else* (as an admin adding a new staff member) needs a small piece of server code — it can't safely be done straight from the browser. This project includes it as a **Supabase Edge Function**.

1. Install the Supabase CLI: https://supabase.com/docs/guides/cli (one-time)
2. In a terminal, inside this project folder:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF   # found in Project Settings → General
   supabase functions deploy create-staff
   ```
3. That's it — the function automatically has access to what it needs on Supabase's side. Nothing here touches your GitHub Pages site.

*(If this step feels too technical to do alone, it's the one part worth asking a developer friend to help with once — after that, everything else in this app is point-and-click.)*

## 6. Put the site on GitHub Pages

1. Create a new GitHub repository, e.g. `solarfix`
2. Upload everything in this project folder to it (drag-and-drop on github.com works, or `git push` if you're comfortable with git)
3. In the repo: **Settings** → **Pages** → under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)` → **Save**
4. After a minute, GitHub gives you a live link like `https://yourname.github.io/solarfix/`

## 7. Create the first admin account

1. Open your GitHub Pages link
2. Click **"Create the first admin account"** on the sign-in screen
3. Fill in your name, email, and a password → **Create admin account**

This only works once — after the first admin exists, everyone else must be added from the **Staff** screen inside the app (admin only).

## 8. Add your team

As admin: **Staff** → **Add staff member** → fill in their name, email, a temporary password, and their role:

| Role | Can do |
|---|---|
| **Worker** | Add new stock, create/update repair tickets |
| **Secretary** | Everything a Worker can, plus edit/delete stock, run daily reports |
| **Admin** | Everything, plus manage staff accounts and delete records |

Give each person their email + temporary password directly — they can sign in right away.

---

## Using it day-to-day

- **Inventory** — add stock as it arrives, categories match your paper log books (batteries, breakers, panels, inverters, transformers, SPDs, extinguishers). Items below their "low stock" number are flagged automatically.
- **Repairs** — a kanban board from intake to collection. Parts used on a repair automatically deduct from inventory.
- **Daily Report** — pick a date, see the charts and reorder list, then **Print / Save PDF** to share with the boss.
- **Dashboard** — a quick top-level view of stock, repairs, and today's activity.

## A note on offline use

This app needs an internet connection — data is synced live between every device through Supabase. If the shop has patchy internet, entries just need a working connection at the moment they're saved; there's no offline mode in this version.

## Project structure

```
index.html                          the whole app shell + all screens
css/style.css                       all styling (design tokens at the top)
js/supabase-client.js               ← paste your Project URL + anon key here
js/app.js                           navigation, modals, toasts, shared helpers
js/auth.js                          sign in, first-admin setup, sessions
js/inventory.js                     stock list, add/edit/delete, low-stock logic
js/repairs.js                       kanban board, ticket detail, parts used
js/reports.js                       dashboard + daily report + charts + print
js/staff.js                         admin: manage staff accounts
sql/schema.sql                      run once in Supabase's SQL Editor
supabase/functions/create-staff/    edge function, deploy once via Supabase CLI
```
git init
git add .
git commit -m "Initial commit — SolarFix inventory app"
git remote add origin https://github.com/dalusamu83-sketch/solarfix
git branch -M main
git push -u origin main