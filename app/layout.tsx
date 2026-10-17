import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import HeaderSearch from "@/components/HeaderSearch";
import Logo from "@/components/Logo";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Omniscient — 이더리움 자금 흐름 추적",
    template: "%s · Omniscient",
  },
  description:
    "이더리움 지갑 주소를 넣으면 자금 흐름을 그래프로 그리고 위험 신호를 0~100점으로 보여주는 교육·공익 목적의 데모 웹앱",
};

export const viewport: Viewport = {
  themeColor: "#f7f6f2",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <header className="relative border-b border-line-strong bg-canvas">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:h-16 sm:px-6">
            <Link href="/" className="focus-ring -ml-1 flex min-w-0 items-center gap-2.5 rounded-md p-1">
              <Logo className="size-[26px] shrink-0 text-accent" />
              <span className="text-lg font-strong tracking-[-0.01em] text-fg">Omniscient</span>
              <span aria-hidden="true" className="hidden h-4 w-px bg-line-strong sm:block" />
              <span className="hidden text-sm text-muted sm:block">자금 흐름 추적</span>
            </Link>
            <div className="ml-auto flex items-center gap-1 sm:gap-3 print:hidden">
              <HeaderSearch />
              <Link
                href="/sources"
                className="focus-ring inline-flex h-11 items-center rounded-md px-2 text-sm font-medium whitespace-nowrap text-fg-2 transition-colors hover:text-fg md:h-10"
              >
                <span className="md:hidden">계산법</span>
                <span className="hidden md:inline">계산법·출처</span>
              </Link>
              <span className="hidden h-7 items-center rounded-full border border-line-strong px-3 text-xs whitespace-nowrap text-muted lg:inline-flex">
                이더리움 메인넷
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-8 border-t border-line-strong">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-fg-2 sm:px-6 md:flex-row md:items-start md:justify-between md:gap-10">
            <p className="max-w-[60ch]">
              <strong className="font-semibold text-fg">교육·공익 목적</strong>의 데모 프로젝트예요.
              법적·투자 판단의 근거가 아니며, 주소 라벨은 공개된 제3자 자료라 틀릴 수 있어요.
            </p>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-muted md:shrink-0 md:justify-end">
              <Link
                href="/sources"
                className="focus-ring rounded-sm font-medium text-fg underline decoration-line-control underline-offset-4 transition-colors hover:text-accent"
              >
                자료 출처·계산법
              </Link>
              <span>비상업 포트폴리오</span>
              <span>이더리움 메인넷 공개 데이터 기준</span>
              <span className="font-mono">BETA</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
