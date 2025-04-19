import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Font betöltése
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mikroszolgáltatás Dashboard',
  description: 'Monorepo mikroszolgáltatások kezelése',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hu">
      <body className={inter.className}>
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </body>
    </html>
  );
}