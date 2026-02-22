import type { Metadata } from 'next';
import './globals.css';
import { ToasterProvider } from '@/components/toaster-provider';
import { Providers } from './providers';
import { ThemeProvider } from '@/providers/theme-provider';

export const metadata: Metadata = {
  title: 'Inventory Management Portal',
  description: 'RBAC Inventory Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            {children}
            <ToasterProvider />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
