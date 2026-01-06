"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BackgroundEffects } from "@/components/ui";
import { Header } from "@/components/layout";
import { useIsAuthenticated } from "@/stores";

/**
 * Layout for authenticated pages (arena, queue, match, etc.)
 * Redirects to login if not authenticated
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();

  // Redirect to login if not authenticated
  useEffect(() => {
    // Allow a brief moment for hydration before redirecting
    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        router.push("/login");
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, router]);

  // Show nothing while checking auth (prevents flash)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <BackgroundEffects />

      {/* Japanese decorative watermark */}
      <div className="absolute top-32 right-[10%] text-[12rem] font-japanese font-bold text-white/[0.02] select-none leading-none z-0 pointer-events-none hidden lg:block">
        闘
      </div>

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col w-full">
        {children}
      </main>

      {/* Bottom decorative lines */}
      <div className="fixed bottom-0 left-0 w-full flex justify-between px-12 pb-6 z-20 pointer-events-none opacity-30">
        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-primary" />
        <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-primary" />
      </div>
    </div>
  );
}
