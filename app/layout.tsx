import './globals.css';
import { ToasterProvider } from '@/components/toaster-provider';
import { Providers } from './providers';
import { ThemeProvider } from '@/providers/theme-provider';
import type { Metadata } from 'next';
import { SITE } from '@/lib/seo/site';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.siteUrl),
  title: {
    default: SITE.brandName,
    template: `%s | ${SITE.brandName}`,
  },
  description: SITE.description,
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
      <body className={`${inter.className} antialiased`}>
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
