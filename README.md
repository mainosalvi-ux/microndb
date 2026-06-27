# Micronation DB — Vercel Deploy

## Deploy to Vercel

1. Push this folder to GitHub
2. Go to vercel.com → New Project → Import your repo
3. Add these Environment Variables:
   - `DATABASE_URL` → your Supabase connection string
   - `SESSION_SECRET` → any long random string (e.g. "micronation-super-secret-2024")
   - `NODE_ENV` → `production`
4. Click Deploy

## Local development

```bash
npm install
# Create .env file with your DATABASE_URL and SESSION_SECRET
node server.js
```

## Admin login
- Email: mainosalvi@gmail.com
- Password: salvi3141
