<<<<<<< HEAD
# 🌍 Micronation Database

A full-stack web app where an admin creates accounts for micronations, each with their own custom collection. All records go into a shared general database.

## Tech stack
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3) — file-based, no setup needed
- **Auth**: Session-based (express-session + bcrypt)
- **Frontend**: Vanilla HTML/CSS/JS

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## Default admin credentials
- **Email**: `mainosalvi@gmail.com`
- **Password**: `admin123`

> ⚠️ Change the admin password after first login (edit the `seedAdmin` function in `routes/auth.js`).

---

## How it works

### Admin (`mainosalvi@gmail.com`)
1. Go to **Accounts → Create account**
2. Set the user's name, email, password, and their micronation name
3. Define the fields (columns) for their collection — e.g. "City Name", "Population", "Founded"
4. The user can now log in and add records to their collection

### Users
- Each user sees only their own micronation's collection
- They can add, edit, and delete their own records
- All records are visible to the admin under **Nations**

---

## Deploy to Railway (free tier)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set environment variable: `SESSION_SECRET=some-long-random-string`
4. Done! Railway auto-detects Node.js and runs `npm start`

## Deploy to Render

1. Push to GitHub
2. New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add env var: `SESSION_SECRET=your-secret`

---

## Project structure

```
micronation-db/
├── server.js           # Express app entry point
├── routes/
│   ├── database.js     # SQLite setup & schema
│   ├── auth.js         # Login, logout, session
│   ├── admin.js        # Admin: users, nations, stats
│   └── records.js      # CRUD for records
├── public/
│   ├── index.html      # Single-page frontend
│   ├── css/style.css
│   └── js/app.js
├── db/                 # SQLite file lives here (auto-created)
└── package.json
```
=======
# microndb
>>>>>>> bb4217b2b15ff4296de71a58b18845f0d1dd76eb
