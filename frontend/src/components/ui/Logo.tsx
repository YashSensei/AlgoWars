"use client";

import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

interface LogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show the Japanese subtitle */
  showSubtitle?: boolean;
  /** Additional class names */
  className?: string;
}

const sizes = {
  sm: {
    container: "size-8",
    icon: 18,
    title: "text-lg",
    subtitle: "text-[8px]",
  },
  md: {
    container: "size-10",
    icon: 24,
    title: "text-xl",
    subtitle: "text-[10px]",
  },
  lg: {
    container: "size-14",
    icon: 32,
    title: "text-2xl",
    subtitle: "text-xs",
  },
};

/**
 * AlgoWars Logo component
 * Includes rotating geometric shape with code icon
 *
 * @example
 * <Logo size="md" showSubtitle />
 */
export function Logo({ size = "md", showSubtitle = true, className }: LogoProps) {
  const s = sizes[size];

  return (
    <div
      className={cn(
        "flex items-center gap-4 select-none cursor-pointer group",
        className
      )}
    >
      {/* Geometric icon container */}
      <div className={cn("relative flex items-center justify-center", s.container)}>
        {/* Rotating squares */}
        <div className="absolute inset-0 border border-primary/30 rotate-45 group-hover:rotate-90 transition-transform duration-500" />
        <div className="absolute inset-0 border border-white/10 rotate-[22.5deg]" />
        {/* Code icon */}
        <Icon name="code" size={s.icon} className="text-primary relative z-10" />
      </div>

      {/* Text */}
      <div className="flex flex-col">
        <h2
          className={cn(
            "text-white font-bold tracking-tight leading-none uppercase",
            s.title
          )}
        >
          ALGOWARS
        </h2>
        {showSubtitle && (
          <span
            className={cn(
              "text-primary font-japanese tracking-widest uppercase",
              s.subtitle
            )}
          >
            アルゴウォーズ
          </span>
        )}
      </div>
    </div>
  );
}

export default Logo;
