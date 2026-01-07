"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@/stores";

/**
 * Layout for match pages - no navbar, full viewport
 * Like LeetCode's problem-solving view
 */
export default function MatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();

  // Redirect to login if not authenticated
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        router.push("/login");
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, router]);

  // Show nothing while checking auth
  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-dark">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg-dark">
      {children}
    </div>
  );
}
