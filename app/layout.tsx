import { Inter } from 'next/font/google';

import type { Metadata } from 'next';

import './globals.css';
import { CommandPalette } from '@/src/components/command-palette';
import { AuthProvider } from '@/src/components/providers/auth-provider';
import { QueryProvider } from '@/src/components/providers/query-provider';
import { ThemeProvider } from '@/src/components/providers/theme-provider';
import { ThemedToaster } from '@/src/components/providers/themed-toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Stock Tracker - Real-time Stock Data',
  description:
    'Track real-time stock data, manage your portfolio, and stay updated with market trends.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground min-h-screen antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <AuthProvider>
              {children}
              <CommandPalette />
              <ThemedToaster />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
