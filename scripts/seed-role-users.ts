/**
 * Upsert dummy users for all roles (no wipe). Use when you need to add or activate
 * role users on an existing database. Password: password123.
 *
 * Run: npm run db:seed:users  or  npx tsx scripts/seed-role-users.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const ROLE_ACCOUNTS = [
  { email: 'admin@example.com', name: 'Admin User', roleName: 'admin' },
  { email: 'manager@example.com', name: 'Manager User', roleName: 'manager' },
  { email: 'staff@example.com', name: 'Staff User', roleName: 'staff' },
  { email: 'viewer@example.com', name: 'Viewer User', roleName: 'viewer' },
  { email: 'inventory_clerk@example.com', name: 'Inventory Clerk', roleName: 'inventory_clerk' },
  { email: 'warehouse_lead@example.com', name: 'Warehouse Lead', roleName: 'warehouse_lead' },
  { email: 'procurement@example.com', name: 'Procurement User', roleName: 'procurement' },
  { email: 'sales_rep@example.com', name: 'Sales Rep', roleName: 'sales_rep' },
  { email: 'reports_only@example.com', name: 'Reports Only User', roleName: 'reports_only' },
];

const DEFAULT_PASSWORD = 'password123';

async function main() {
  const prisma = new PrismaClient();
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));

  for (const acc of ROLE_ACCOUNTS) {
    const roleId = roleByName.get(acc.roleName);
    if (!roleId) {
      console.warn(`Skipping ${acc.email}: role "${acc.roleName}" not found. Run full seed first.`);
      continue;
    }
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: { isActive: true, name: acc.name },
      create: {
        email: acc.email,
        name: acc.name,
        passwordHash: hashedPassword,
        isActive: true,
        emailVerified: new Date(),
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
    console.log('  ', acc.email, '->', acc.roleName);
  }

  console.log('\n✅ Role users upserted. Password for all:', DEFAULT_PASSWORD);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
