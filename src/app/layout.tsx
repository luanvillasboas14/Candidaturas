import React from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AppShell } from '@/components/AppShell';

export const metadata = {
  title: 'DNA Work',
  description: 'Sistema interno DNA Work',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
