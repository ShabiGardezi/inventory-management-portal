# Vercel env checklist (local works, live fails)

Your app needs these **exact variable names** on Vercel. Local uses `.env`; Vercel only uses what you add in the dashboard.

## Required variables on Vercel

| Variable        | Where it's used | Notes |
|-----------------|-----------------|--------|
| `DATABASE_URL`  | Prisma (app queries) | **Pooled** URL, port **6543**, must end with `?pgbouncer=true&sslmode=require` |
| `DIRECT_URL`    | Prisma (migrations / internal) | **Direct** URL, host **db.XXX.supabase.co**, port **5432**, include `?sslmode=require` |
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | NextAuth | One of them; same value as local is fine |
| `NEXTAUTH_URL`  | NextAuth (optional) | Your live URL, e.g. `https://your-app.vercel.app` |

## Why live fails when local works

1. **Variables not set on Vercel** – They are not copied from `.env`. You must add each one in **Vercel → Project → Settings → Environment Variables**.
2. **Wrong URL format on Vercel** – Supabase free tier requires SSL. On Vercel you must use:
   - `DATABASE_URL`: pooler URL with **`&sslmode=require`** at the end.
   - `DIRECT_URL`: direct host **`db.<project-ref>.supabase.co`** (not pooler host), with **`?sslmode=require`**.
3. **No redeploy after adding env** – After saving variables, use **Redeploy** so the new build uses them.

## Quick check (no secrets)

To see only variable **names** in your local `.env` (values hidden):

```bash
grep -E '^[A-Z_]+' .env | cut -d= -f1
```

You should see at least: `DATABASE_URL`, `DIRECT_URL`, and one of `AUTH_SECRET` / `NEXTAUTH_SECRET`.  
Ensure the **same names** exist in Vercel with the correct production values (pooled + direct URLs with SSL).

## Supabase free + Vercel free

- Both tiers allow this setup.
- Use **Connection pooling** (6543) for `DATABASE_URL` to stay within connection limits.
- Direct URL for `DIRECT_URL`: in Supabase Dashboard → **Project Settings** → **Database** → **Connection string** → **Direct connection** (URI).
