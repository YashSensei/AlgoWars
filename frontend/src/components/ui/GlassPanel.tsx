"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Show the corner accent decorations */
  showCornerAccents?: boolean;
  /** Inner padding - defaults to "p-8" */
  padding?: string;
}

/**
 * Glass panel card with optional corner accents
 * Uses blur backdrop and subtle border from design
 *
 * @example
 * <GlassPanel showCornerAccents>
 *   <h2>Content</h2>
 * </GlassPanel>
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      className,
      children,
      showCornerAccents = true,
      padding = "p-8",
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn("glass-panel relative overflow-hidden", className)}
        {...props}
      >
        {/* Corner accents */}
        {showCornerAccents && (
          <>
            <div className="corner-accent-tl" />
            <div className="corner-accent-br" />
          </>
        )}

        {/* Content wrapper */}
        <div className={cn("relative z-10 flex flex-col h-full", padding)}>
          {children}
        </div>
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";

export default GlassPanel;
