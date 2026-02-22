/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure Prisma engines are included in Vercel/standalone output.
    // Fixes: "Prisma Client could not locate the Query Engine for runtime rhel-openssl-3.0.x"
    outputFileTracingIncludes: {
      '/api/**': ['node_modules/.prisma/client/**', 'node_modules/@prisma/client/**'],
      '/**': ['node_modules/.prisma/client/**', 'node_modules/@prisma/client/**'],
    },
  },
};

module.exports = nextConfig;

