import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt, pickOne } from '../utils';

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy',
  'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

export interface SeedUsersResult {
  users: Array<{ id: string; email: string }>;
  userIdByEmail: Map<string, string>;
}

export async function seedUsers(
  prisma: PrismaClient,
  count: number,
  roles: Array<{ id: string; name: string }>,
  defaultPassword: string
): Promise<SeedUsersResult> {
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  const userIdByEmail = new Map<string, string>();
  const users: Array<{ id: string; email: string }> = [];

  // Dummy users for every role (system + custom). Password: same as defaultPassword (e.g. password123).
  const roleAccounts = [
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

  const roleByName = new Map(roles.map((r) => [r.name, r.id]));

  for (const acc of roleAccounts) {
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: { isActive: true },
      create: {
        email: acc.email,
        name: acc.name,
        passwordHash: hashedPassword,
        isActive: true,
        emailVerified: new Date(),
      },
    });
    users.push({ id: user.id, email: user.email });
    userIdByEmail.set(user.email, user.id);
    const roleId = roleByName.get(acc.roleName);
    if (roleId) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: { userId: user.id, roleId },
        },
        update: {},
        create: { userId: user.id, roleId },
      });
    }
  }

  const extraCount = Math.max(0, count - roleAccounts.length);
  const usedEmails = new Set(roleAccounts.map((a) => a.email));

  for (let i = 0; i < extraCount; i++) {
    let name: string;
    let email: string;
    let attempts = 0;
    do {
      const first = pickOne(FIRST_NAMES);
      const last = pickOne(LAST_NAMES);
      name = `${first} ${last}`;
      const suffix = attempts > 0 ? `+${i}${attempts}` : i;
      email = `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@example.com`;
      attempts++;
    } while (usedEmails.has(email) && attempts < 100);
    usedEmails.add(email);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        isActive: randomInt(0, 10) > 0,
        emailVerified: randomInt(0, 2) === 0 ? null : new Date(),
      },
    });
    users.push({ id: user.id, email: user.email });
    userIdByEmail.set(user.email, user.id);

    const role = pickOne(roles);
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
  }

  return { users, userIdByEmail };
}
