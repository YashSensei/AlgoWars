"use client";

import { cn } from "@/lib/utils";

interface IconProps {
  /** Material Symbols icon name (e.g., "code", "fingerprint", "encrypted") */
  name: string;
  /** Size in pixels - defaults to 24 */
  size?: number;
  /** Additional class names */
  className?: string;
  /** Fill variation: 0 (outline) or 1 (filled) */
  fill?: 0 | 1;
}

/**
 * Material Symbols icon wrapper
 * Uses Google's Material Symbols Outlined font
 *
 * @example
 * <Icon name="code" size={24} className="text-primary" />
 */
export function Icon({ name, size = 24, className, fill = 0 }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined select-none", className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill}`,
      }}
    >
      {name}
    </span>
  );
}

export default Icon;
