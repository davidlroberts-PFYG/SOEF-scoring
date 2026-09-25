import type { Metadata, Viewport } from 'next';
import { Montserrat, Roboto } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-montserrat',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'Value Gap Dashboard',
  description:
    'Readiness scoring and estimated value gap for business owners. Estimates only; not a business appraisal.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0a1f33',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${roboto.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
