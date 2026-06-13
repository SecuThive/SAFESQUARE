import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientProviders from '@/components/ui/ClientProviders';

export const metadata: Metadata = {
  title: 'SAFESQUARE — Internal Platform',
  description: 'Security engineering team management system',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,          // 확대 허용 (접근성)
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className="h-screen overflow-hidden">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
