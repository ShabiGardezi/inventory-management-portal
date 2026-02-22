import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { compare } from 'bcryptjs';

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }
        const email = String(credentials.email);
        const password = String(credentials.password);

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
            include: {
              userRoles: {
                include: {
                  role: {
                    include: {
                      rolePermissions: {
                        include: {
                          permission: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[auth] Database error during login:', msg);
          throw new Error('Database connection failed');
        }

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await compare(
          password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null; // NextAuth shows "Invalid email or password" (CredentialsSignin)
        }

        // Extract permissions from user roles
        const permissions = new Set<string>();
        user.userRoles.forEach((userRole) => {
          userRole.role.rolePermissions.forEach((rolePermission) => {
            permissions.add(rolePermission.permission.name);
          });
        });

        const roles = user.userRoles.map((ur) => ur.role.name);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles,
          permissions: Array.from(permissions),
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.roles = user.roles ?? [];
        token.permissions = user.permissions ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.roles = (token.roles as string[]) ?? [];
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true, // Required for NextAuth v5
};
