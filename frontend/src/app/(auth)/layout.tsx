"use client";

import { BackgroundEffects, Logo, StatusIndicator } from "@/components/ui";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <BackgroundEffects />

      {/* Japanese decorative watermark - 戦 (battle) */}
      <div className="absolute top-20 right-20 text-[20rem] font-japanese font-bold text-white/5 select-none leading-none z-0 pointer-events-none hidden lg:block">
        戦
      </div>

      {/* Vertical Japanese text decoration */}
      <div className="absolute bottom-40 left-10 writing-mode-vertical text-xs font-japanese text-white/10 tracking-[1em] select-none z-0 hidden md:block [writing-mode:vertical-rl]">
        アルゴリズム戦争・開始
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-6 md:px-12 w-full max-w-[1400px] mx-auto">
        <Logo size="md" showSubtitle />

        {/* System Status */}
        <div className="hidden md:flex gap-8 items-center">
          <StatusIndicator status="online" label="System Online" />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        {children}
      </main>

      {/* Bottom decorative lines */}
      <div className="absolute bottom-0 left-0 w-full flex justify-between px-12 pb-6 z-20 pointer-events-none opacity-50">
        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-primary" />
        <div className="h-[1px] w-full max-w-[400px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-primary" />
      </div>
    </div>
  );
}
