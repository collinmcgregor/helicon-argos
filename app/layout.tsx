import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import { NavRail } from '@/components/NavRail';
import { TopBar } from '@/components/TopBar';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Helicon Argos',
  description: 'Manufacturing operations console',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense>
          <NavRail />
        </Suspense>
        <Suspense>
          <TopBar />
        </Suspense>
        <main className="ml-[220px] pt-12">
          <div className="p-4">{children}</div>
        </main>
      </body>
    </html>
  );
}
