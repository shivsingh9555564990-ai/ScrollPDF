import type {Metadata} from 'next';
import './globals.css'; // Global styles
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

export const metadata: Metadata = {
  title: 'ZeraNotes',
  description: 'AI-Powered Study Notes Generator',
  manifest: '/manifest.json',
  themeColor: '#ffffff',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ZeraNotes'
  }
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
