# 🪪 Dagupan Employee ID System

City Government of Dagupan · HR Module  
Built with **React + Vite + Supabase**, deploy-ready for **Vercel**

---

## Features

- ✅ **Auth** — Email/password login (Supabase Auth), multiple HR accounts
- ✅ **Employee Management** — Add, edit, delete, search & filter ~1,700 employees
- ✅ **Photo Support** — Upload to Supabase Storage OR paste Google Drive / URL
- ✅ **ID Card Printing** — Dagupan format with QR code, 3 size options
- ✅ **Batch Print** — Select multiple employees → print all sunod-sunod
- ✅ **Bulk Import** — CSV import from Google Sheets export
- ✅ **Print Sizes** — CR80 (standard), A6, A5
- ✅ **Pagination** — Handles 1,700+ records smoothly

---

## Setup Instructions

### Step 1 — Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Save your **Project URL** and **Anon Key** (Settings → API)

### Step 2 — Run Database Setup

1. Go to **Supabase Dashboard → SQL Editor**
2. Copy and run the entire contents of `supabase-setup.sql`
3. This creates the `employees` table, indexes, RLS policies, and storage bucket

### Step 3 — Configure Environment

1. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Fill in your values:
   ```
   VITE_SUPABASE_URL=https://yourproject.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### Step 4 — Install & Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

### Step 5 — Create First User

1. Open the app → click **"Don't have an account? Sign up"**
2. Enter your email and password
3. Check your email for a confirmation link (or disable email confirmation in Supabase Auth settings for testing)

> **To disable email confirmation (for testing):**  
> Supabase Dashboard → Authentication → Settings → Disable "Confirm email"

---

## Deploy to Vercel

### Option A — Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B — GitHub + Vercel Dashboard
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

---

## Importing Employees from Google Sheets

### Export from Google Sheets:
1. File → Download → CSV (.csv)

### Required columns (any order):
| Column Name | Maps To |
|---|---|
| Last Name | last_name |
| First Name | first_name |
| Middle Name | middle_name |
| Middle Initial | middle_initial |
| Employee ID | employee_id |
| Position | position |
| Department | department |
| Photo URL / Updated ID Picture | photo_url |

### Import steps:
1. Go to **Import CSV** in the app
2. Upload your CSV file
3. Review the preview (first 50 rows shown)
4. Click **Import All**

---

## Printing IDs

### Card Sizes:
| Size | Dimensions | Cards per A4 page |
|---|---|---|
| CR80 (Standard) | 85.6mm × 53.98mm | 10 |
| A6 | 105mm × 74.25mm | 4 |
| A5 | 148mm × 105mm | 2 |

### How to batch print:
1. Go to **Employees** → check the employees you want
2. Click **Print Selected IDs** in the selection bar
3. This takes you to Print page with the queue pre-loaded
4. Select your card size
5. Click **Print All**

---

## Project Structure

```
src/
├── components/
│   ├── IDCard.jsx          # ID card renderer (Dagupan format)
│   ├── EmployeeModal.jsx   # Add/Edit employee form
│   └── Sidebar.jsx         # Navigation sidebar
├── context/
│   └── AuthContext.jsx     # Supabase auth state
├── lib/
│   └── supabase.js         # Supabase client
├── pages/
│   ├── Dashboard.jsx       # Stats overview
│   ├── Employees.jsx       # Employee list + management
│   ├── Print.jsx           # Print queue + preview
│   └── Import.jsx          # CSV import
├── App.jsx                 # Router + layout
├── main.jsx
└── index.css               # Design system + print CSS
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React 18 + Vite | Frontend framework |
| React Router v6 | Client-side routing |
| Supabase | Database + Auth + Storage |
| lucide-react | Icons |
| react-hot-toast | Notifications |
| qrcode | QR code generation |
| DM Sans + DM Serif Display | Typography (Google Fonts) |

---

## License
Internal use — City Government of Dagupan HR Department
