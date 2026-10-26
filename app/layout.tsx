import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { StadiumBackdrop } from '@/components/StadiumBackdrop';
import './globals.css';

/** 갈무리11: 닌텐도 DS 스타일 한글 비트맵 폰트 (OFL, app/fonts/Galmuri-LICENSE.txt) */
const galmuri = localFont({
  src: [
    { path: './fonts/Galmuri11.woff2', weight: '400' },
    { path: './fonts/Galmuri11-Bold.woff2', weight: '700' },
  ],
  variable: '--font-galmuri',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '축구 커리어 시뮬레이터',
  description: '16세 유망주에서 은퇴까지, 웹 기반 축구 개인 커리어 시뮬레이션',
};

export const viewport: Viewport = {
  themeColor: '#070c17',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`dark h-full antialiased ${galmuri.variable}`}>
      <body className="relative flex min-h-full flex-col">
        <StadiumBackdrop />
        {children}
      </body>
    </html>
  );
}
