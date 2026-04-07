# ☕ Chicken Affair — Management App

A complete café management system replacing Petpooja.  
Single app, role-based access: Owner · Manager · Captain · Biller

---

## Project Structure

```
src/
├── context/
│   └── AuthContext.js        ← Login, logout, role permissions
├── components/
│   ├── Layout.js             ← Sidebar + navigation (role-filtered)
│   └── ProtectedRoute.js     ← Route guards
├── lib/
│   └── supabase.js           ← Supabase client
└── pages/
    ├── auth/LoginPage.js
    ├── dashboard/DashboardPage.js
    ├── orders/OrdersPage.js
    ├── tables/TablesPage.js
    ├── billing/BillingPage.js
    ├── menu/MenuPage.js
    ├── inventory/InventoryPage.js
    ├── reports/ReportsPage.js
    ├── staff/StaffPage.js
    ├── settings/SettingsPage.js
    └── kds/KDSPage.js        ← Kitchen Display (no login, full screen)
```

---

## Setup — Step by Step

### Step 1 — Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project → Name it `Chicken Affair-cafe`
2. Choose region: `ap-south-1` (Mumbai)
3. Save your database password
4. Go to **Settings → API** → copy your **Project URL** and **anon/public key**

### Step 2 — Run the database schema
1. In Supabase → go to **SQL Editor**
2. Open `supabase_schema.sql` from this project
3. Paste the entire file and click **Run**
4. All tables are created ✓

### Step 3 — Create the first owner account
1. Supabase → **Authentication → Users → Invite User**
2. Enter your email and send invite
3. Once confirmed, go to **SQL Editor** and run:
```sql
INSERT INTO staff (user_id, name, role)
VALUES ('<paste-user-id-here>', 'Your Name', 'owner');
```

### Step 4 — Set up environment variables
1. Copy `.env.example` to `.env`
2. Fill in your Supabase URL and anon key:
```
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_key_here
```

### Step 5 — Install and run
```bash
npm install
npm start
```
App opens at http://localhost:3000

---

## Deploying to Vercel

1. Push this folder to a **private GitHub repository**
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add environment variables in Vercel → Settings → Environment Variables
4. Deploy ✓

Every push to GitHub auto-deploys — no manual steps ever.

---

## What's built in this skeleton

| Module         | Status       | Notes                                      |
|----------------|--------------|--------------------------------------------|
| Login          | ✅ Working    | Email/password via Supabase Auth           |
| Role Routing   | ✅ Working    | Each role sees only permitted pages        |
| Dashboard      | 🔲 Skeleton   | UI ready, needs Supabase data queries      |
| Orders / KOT   | 🔲 Skeleton   | UI scaffold, full build next phase         |
| Tables         | 🔲 Skeleton   | Visual grid ready, needs live data         |
| Billing        | 🔲 Skeleton   | UI scaffold, full build next phase         |
| Menu           | 🔲 Skeleton   | Sample data, needs Supabase connection     |
| Inventory      | 🔲 Skeleton   | Sample data, needs Supabase connection     |
| Reports        | 🔲 Skeleton   | Cards ready, report queries next phase     |
| Staff          | 🔲 Skeleton   | Sample data, needs Supabase connection     |
| Settings       | 🔲 Skeleton   | Cards ready, forms next phase              |
| KDS Screen     | ✅ Working    | Fully interactive with sample data         |

---

## Role Access Summary

| Feature        | Owner | Manager | Captain | Biller |
|----------------|-------|---------|---------|--------|
| Dashboard      | ✓     | ✓       | Limited | Limited|
| Orders / KOT   | ✓     | ✓       | ✓       | View   |
| Tables         | ✓     | ✓       | Own     | ✓      |
| Billing        | ✓     | ✓       | ✗       | ✓      |
| Menu           | ✓     | ✓       | ✗       | ✗      |
| Inventory      | ✓     | ✓       | ✗       | ✗      |
| Reports        | ✓     | ✓       | ✗       | ✗      |
| Staff          | ✓     | ✗       | ✗       | ✗      |
| Settings       | ✓     | ✗       | ✗       | ✗      |
| KDS Screen     | ✓     | ✓       | ✗       | ✗      |
