import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './globals.css';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { club } from '@/lib/club';

export const metadata: Metadata = {
  title: { default: club.name, template: `%s | ${club.short}` },
  description:
    'Events, RSVPs, attendance and the CTF leaderboard for the Girls Who Code chapter at UT Dallas.',
};

export const viewport: Viewport = {
  themeColor: '#f7f5fc',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
