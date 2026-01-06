"use client";

import { cn } from "@/lib/utils";

type StatusType = "online" | "offline" | "warning" | "error";

interface StatusIndicatorProps {
  /** Status type determines the color */
  status?: StatusType;
  /** Text label to display */
  label?: string;
  /** Additional class names */
  className?: string;
}

const statusColors: Record<StatusType, string> = {
  online: "bg-primary",
  offline: "bg-gray-500",
  warning: "bg-accent-gold",
  error: "bg-red-500",
};

const statusGlows: Record<StatusType, string> = {
  online: "shadow-[0_0_8px_rgba(255,51,68,0.8)]",
  offline: "shadow-none",
  warning: "shadow-[0_0_8px_rgba(251,191,36,0.8)]",
  error: "shadow-[0_0_8px_rgba(239,68,68,0.8)]",
};

/**
 * Status indicator with pulsing dot
 * Used in header for "System Online" display
 *
 * @example
 * <StatusIndicator status="online" label="System Online" />
 */
export function StatusIndicator({
  status = "online",
  label = "System Online",
  className,
}: StatusIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-text-muted text-xs uppercase tracking-widest",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full animate-pulse",
          statusColors[status],
          statusGlows[status]
        )}
      />
      <span className="font-medium">{label}</span>
    </div>
  );
}

export default StatusIndicator;
