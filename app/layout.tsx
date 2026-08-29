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
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* pre-paint theme restore; light is the default when nothing is stored */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem("argos-theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`,
          }}
        />
      </head>
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
