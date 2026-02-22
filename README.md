# Inventory Management Portal

RBAC Inventory Management System built with Next.js 15, TypeScript, PostgreSQL, Prisma, and NextAuth.

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Database

Update the `.env` file with your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/inventory_db?schema=public"
```

**Example for local PostgreSQL:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inventory_db?schema=public"
```

**To create a new PostgreSQL database:**
```bash
# Using psql
createdb inventory_db

# Or using SQL
psql -U postgres
CREATE DATABASE inventory_db;
```

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This will:
- Create all database tables
- Set up relationships and indexes
- Generate Prisma Client

### 4. Seed the Database

```bash
npm run db:seed
```

This will create:
- 4 default roles (admin, manager, staff, viewer)
- 30+ permissions
- 4 test users
- 2 sample warehouses
- 5 sample products
- Initial stock balances

### 5. Test Users

After seeding, you can login with:

- **Admin**: `admin@example.com` / `password123`
- **Manager**: `manager@example.com` / `password123`
- **Staff**: `staff@example.com` / `password123`
- **Viewer**: `viewer@example.com` / `password123`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma Client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed the database
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:push` - Push schema changes without migrations

## Database Schema

### RBAC Models
- `users` - User accounts
- `roles` - User roles
- `permissions` - System permissions
- `user_roles` - User-role assignments
- `role_permissions` - Role-permission assignments

### Inventory Models
- `products` - Product catalog (unique SKU)
- `warehouses` - Warehouse locations (unique code)
- `stock_movements` - Stock transaction history
- `stock_balances` - Current stock levels per product/warehouse
- `audit_logs` - System audit trail

## Next Steps

1. Update `.env` with your database credentials
2. Run migrations: `npm run db:migrate`
3. Seed database: `npm run db:seed`
4. Start building your API routes and UI

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth (JWT strategy)
