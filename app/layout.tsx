import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '축구 커리어 시뮬레이터',
  description: '16세 유망주에서 은퇴까지, 웹 기반 축구 개인 커리어 시뮬레이션',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
