# Deploying to Vercel with Supabase

If you see **"Database connection failed"** on login after deploying to Vercel, the app cannot reach your Supabase database. Fix it by setting environment variables and using the right connection strings.

## 1. Set environment variables in Vercel

1. Open your project on [Vercel](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add these (for **Production**, and optionally Preview/Development):

| Variable         | Where to get it | Notes |
|------------------|-----------------|--------|
| `DATABASE_URL`   | Supabase Dashboard → **Project Settings** → **Database** → **Connection string** → **URI** | Use the **Connection pooling** (Transaction mode) string: port **6543**, host `*.pooler.supabase.com`. |
| `DIRECT_URL`     | Same page → **Direct connection** URI | Port **5432**, used by Prisma for migrations and some operations. |
| `NEXTAUTH_SECRET` or `AUTH_SECRET` | Generate: `openssl rand -base64 32` | Required for NextAuth. |
| `NEXTAUTH_URL`   | Your live URL, e.g. `https://your-app.vercel.app` | Optional but recommended. |

3. **Redeploy** the project (Deployments → … → Redeploy) so new variables are applied.

## 2. Use Supabase connection pooling for DATABASE_URL

Serverless (Vercel) can open many DB connections. Use the **pooled** URL for `DATABASE_URL` so Supabase doesn’t hit connection limits.

- In Supabase: **Project Settings** → **Database**.
- Under **Connection string**, choose **Transaction** (or **Session**).
- Copy the **URI**; it should look like:
  - Pooler (recommended): `postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`
  - Add `?sslmode=require` (or `&sslmode=require` if you already have `?pgbouncer=true`). **Supabase requires SSL**; without it the connection can fail in production.

Use this pooled URI as **DATABASE_URL** in Vercel. Example:
`...6543/postgres?pgbouncer=true&sslmode=require`  
Use the **direct** connection (port 5432) as **DIRECT_URL**.

## 3. Checklist

- [ ] `DATABASE_URL` in Vercel = Supabase **pooler** URI (port 6543).
- [ ] `DIRECT_URL` in Vercel = Supabase **direct** URI (port 5432).
- [ ] Both include `?sslmode=require` if your Supabase project requires SSL.
- [ ] `NEXTAUTH_SECRET` (or `AUTH_SECRET`) is set.
- [ ] Redeploy after changing env vars.

## 4. Still failing?

- In Supabase **Project Settings** → **Database**, ensure **Restrict connections** is not blocking Vercel (or leave it off for testing).
- In Vercel, confirm the variables show under **Settings** → **Environment Variables** for the environment you’re using (Production/Preview).
- Check the **Runtime Logs** for the deployment to see the exact connection or Prisma error.
