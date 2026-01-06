"use client";

import { cn } from "@/lib/utils";

interface BackgroundEffectsProps {
  className?: string;
  /** Show the noise texture overlay */
  showNoise?: boolean;
  /** Show the purple/indigo orb (top-left) */
  showPurpleOrb?: boolean;
  /** Show the red/primary orb (bottom-right) */
  showRedOrb?: boolean;
  /** Show the cyber grid pattern */
  showGrid?: boolean;
}

/**
 * Background visual effects layer - placed at z-0, pointer-events-none
 *
 * Usage:
 * ```tsx
 * <div className="relative min-h-screen">
 *   <BackgroundEffects />
 *   <main className="relative z-10">...</main>
 * </div>
 * ```
 */
export function BackgroundEffects({
  className,
  showNoise = true,
  showPurpleOrb = true,
  showRedOrb = true,
  showGrid = false,
}: BackgroundEffectsProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-0 pointer-events-none overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {/* Noise texture overlay */}
      {showNoise && <div className="absolute inset-0 bg-noise" />}

      {/* Purple/Indigo gradient orb - top left */}
      {showPurpleOrb && (
        <div
          className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full blur-[120px] mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Red/Primary gradient orb - bottom right */}
      {showRedOrb && (
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[100px] mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle, rgba(255, 51, 68, 0.12) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Cyber grid pattern (optional) */}
      {showGrid && (
        <div className="absolute inset-0 cyber-grid opacity-20 mask-image-gradient" />
      )}
    </div>
  );
}

export default BackgroundEffects;
