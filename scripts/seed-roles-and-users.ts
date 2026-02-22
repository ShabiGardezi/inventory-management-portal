/**
 * Seed only permissions, roles, and role users (no products, warehouses, or other data).
 * Use when the users table is empty but you have other data and don't want to wipe.
 *
 * Run: npm run db:seed:roles-users  or  npx tsx scripts/seed-roles-and-users.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedPermissions, seedRoles } from '../prisma/seed/generators/rolesPermissions';
import { seedUsers } from '../prisma/seed/generators/users';
import { initSeed } from '../prisma/seed/utils';
import { getSeedConfig } from '../prisma/seed/seedConfig';

async function main() {
  const prisma = new PrismaClient();
  const config = getSeedConfig();
  initSeed(config.seed);

  console.log('Seeding permissions...');
  const permissions = await seedPermissions(prisma);
  console.log('  ', permissions.length, 'permissions');

  console.log('Seeding roles...');
  const roles = await seedRoles(prisma, permissions);
  console.log('  ', roles.length, 'roles');

  console.log('Seeding role users (password: password123)...');
  const ROLE_ACCOUNTS_COUNT = 9;
  const { users } = await seedUsers(prisma, ROLE_ACCOUNTS_COUNT, roles, 'password123');
  console.log('  ', users.length, 'users');

  console.log('\n✅ Done. You can log in with admin@example.com / password123');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
