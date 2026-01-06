"use client";

import Link from "next/link";
import { Logo, StatusIndicator, Button, Icon } from "@/components/ui";
import { useIsAuthenticated, useUser, useAuthStore } from "@/stores";
import { cn } from "@/lib/utils";

interface HeaderProps {
  /** Make header sticky with blur background */
  sticky?: boolean;
  /** Show border bottom */
  showBorder?: boolean;
  className?: string;
}

export function Header({ sticky = true, showBorder = true, className }: HeaderProps) {
  const isAuthenticated = useIsAuthenticated();
  const user = useUser();
  const logout = useAuthStore((s) => s.logout);

  return (
    <header
      className={cn(
        "relative z-50 flex items-center justify-between px-6 py-5 md:px-12 w-full max-w-[1400px] mx-auto",
        sticky && "sticky top-0 bg-bg-dark/80 backdrop-blur-md",
        showBorder && "border-b border-white/5",
        className
      )}
    >
      {/* Logo */}
      <Link href="/">
        <Logo size="md" showSubtitle />
      </Link>

      {/* Right side */}
      <nav className="hidden md:flex items-center gap-8">
        {/* Nav links */}
        <Link
          href="/leaderboard"
          className="text-text-muted hover:text-white text-[11px] font-medium uppercase tracking-widest transition-colors"
        >
          Leaderboard
        </Link>

        {/* Status indicator */}
        <StatusIndicator status="online" label="System Online" />

        {/* Auth buttons */}
        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            <Link
              href="/arena"
              className="text-text-muted hover:text-white text-[11px] font-medium uppercase tracking-widest transition-colors"
            >
              Arena
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white font-bold uppercase">
                {user?.username}
              </span>
              <button
                onClick={logout}
                className="text-text-muted hover:text-primary text-[10px] uppercase tracking-wide transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-text-muted hover:text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
            >
              Login
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">
                Sign Up
              </Button>
            </Link>
          </div>
        )}
      </nav>

      {/* Mobile menu button */}
      <button className="md:hidden text-white">
        <Icon name="menu" size={24} />
      </button>
    </header>
  );
}

export default Header;
