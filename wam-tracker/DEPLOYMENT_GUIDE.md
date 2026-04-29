# WAM Tracker — Deployment Guide
### Get your group live in ~15 minutes, no coding required

---

## Step 1 — Set up your free Supabase database

1. Go to **https://supabase.com** and click **Start your project**
2. Sign up with GitHub or email
3. Click **New project**, give it a name like `wam-tracker`, pick a region close to you, set a password (save it!), click **Create new project**
4. Wait ~2 minutes for it to set up
5. In the left sidebar click **SQL Editor**
6. Paste this entire block and click **Run**:

```sql
-- Members table (one row per WAM member)
create table members (
  id text primary key,
  name text not null default 'Member',
  color text not null default '#e8a87c',
  sort_order integer not null default 0,
  tracker_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Global settings (current week, cycle start date)
create table settings (
  id text primary key,
  current_week integer not null default 1,
  cycle_start text default ''
);

-- Allow anyone with the link to read and write (no login required)
alter table members enable row level security;
alter table settings enable row level security;

create policy "Public read members" on members for select using (true);
create policy "Public write members" on members for all using (true);
create policy "Public read settings" on settings for select using (true);
create policy "Public write settings" on settings for all using (true);

-- Enable real-time so changes appear instantly for everyone
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table settings;
```

7. You should see "Success. No rows returned." — that means it worked ✓

---

## Step 2 — Get your Supabase keys

1. In the left sidebar click **Project Settings** (gear icon) → **API**
2. Copy two values — you'll need them in Step 4:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 3 — Upload the code to GitHub

1. Go to **https://github.com** and sign up for a free account
2. Click the **+** button → **New repository**
3. Name it `wam-tracker`, keep it **Public**, click **Create repository**
4. On the next page, click **uploading an existing file**
5. Upload ALL the files from the `wam-tracker` folder you downloaded:
   ```
   wam-tracker/
   ├── index.html
   ├── package.json
   ├── vite.config.js
   ├── .gitignore
   ├── .env.example
   └── src/
       ├── main.jsx
       ├── App.jsx
       └── supabase.js
   ```
6. Click **Commit changes**

---

## Step 4 — Deploy to Vercel (free hosting)

1. Go to **https://vercel.com** and sign up with your GitHub account
2. Click **Add New → Project**
3. Find and select your `wam-tracker` repository, click **Import**
4. Before clicking Deploy, open **Environment Variables** and add:
   - Name: `VITE_SUPABASE_URL` → Value: your Project URL from Step 2
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: your anon key from Step 2
5. Click **Deploy** and wait ~1 minute
6. Vercel gives you a free URL like `wam-tracker-abc123.vercel.app` 🎉

---

## Step 5 — Share with your group

Just send everyone the Vercel URL! That's it.

- Everyone sees the same data in real time
- Changes (checking a day, updating goals) sync instantly
- The current week setting updates for everyone when anyone changes it
- Works on phone and desktop

---

## Tips

- **Bookmark the URL** on your phone home screen for easy daily access
- **Set the current week** in Settings at the start of each week
- Each person clicks **Edit** on their own card to set up their goals and habits
- The leaderboard updates live as people check off their days

---

## Troubleshooting

**"Error loading"** → Double-check your environment variables in Vercel match exactly what Supabase shows

**Changes not syncing** → Make sure you ran the full SQL block in Step 1 (especially the `alter publication` lines at the bottom)

**Blank page** → Open browser console (F12) — if you see a Supabase error, your keys may be wrong
