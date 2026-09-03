import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://signal-10.minty-trail-0785.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'SIGNAL 10 — 毎朝の生成AIニュース',
  description: '生成AIの重要ニュースを毎朝6:30、重要度順に10本だけ。内容と意味まで日本語で届けます。',
  applicationName: 'SIGNAL 10',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    title: 'SIGNAL 10 — 毎朝の生成AIニュース',
    description: '生成AIの「今日」を、10本だけ。',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'SIGNAL 10 — 生成AIの「今日」を、10本だけ。' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SIGNAL 10 — 毎朝の生成AIニュース',
    description: '生成AIの「今日」を、10本だけ。',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#f5f1e8',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
