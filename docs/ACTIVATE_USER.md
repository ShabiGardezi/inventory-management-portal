# Users table empty or need roles + users

If the **users** table (or **roles**) is empty in Supabase:

1. Ensure your project can reach the DB (Supabase free tier: wake the project in the dashboard if paused).
2. From the project root with `.env` pointing at Supabase, run:
   ```bash
   npm run db:seed:roles-users
   ```
   This seeds **permissions**, **roles**, and **role users** only (no wipe, no products/warehouses). All 9 users get password `password123`.

If roles already exist and you only need to add/update the 9 role users:
```bash
npm run db:seed:users
```

---

# Activate a user account

If login fails with "Invalid email or password" and the terminal shows **"Login rejected: account is inactive"**, the user exists but `isActive` is `false`.

## Fix in Supabase

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Run (replace the email if needed):

```sql
UPDATE users SET "isActive" = true WHERE email = 'admin@example.com';
```

3. Try logging in again.

## Activate all seed users

If you seeded test accounts and they are inactive:

```sql
UPDATE users SET "isActive" = true
WHERE email IN (
  'admin@example.com',
  'manager@example.com',
  'staff@example.com',
  'viewer@example.com'
);
```
