"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Icon to show on the right (Material Symbols name) */
  rightIcon?: string;
  /** Icon to show on the left (Material Symbols name) */
  leftIcon?: string;
  /** Show loading spinner */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  // White bg, black text, hover:red bg, white text - with stripes overlay
  primary: `
    relative overflow-hidden bg-white text-black font-bold
    hover:bg-primary hover:text-white
    transition-all duration-200
  `,
  // Border only, transparent bg
  secondary: `
    bg-transparent border border-border-dark text-white
    hover:border-white/30 hover:bg-white/5
    transition-all duration-200
  `,
  // Red tinted danger button
  danger: `
    bg-transparent border border-red-500/30 text-red-400
    hover:bg-red-500/10 hover:border-red-500/50
    transition-all duration-200
  `,
  // Minimal ghost button
  ghost: `
    bg-transparent text-text-muted
    hover:text-white hover:bg-white/5
    transition-all duration-200
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "py-2 px-3 text-xs",
  md: "py-3 px-4 text-sm",
  lg: "py-3.5 px-6 text-sm",
};

/**
 * Button component with variants matching the design system
 *
 * Primary: White bg with diagonal stripes, red on hover
 * Secondary: Border only, subtle hover effect
 * Danger: Red-tinted for destructive actions
 * Ghost: Minimal, text-only style
 *
 * @example
 * <Button variant="primary" rightIcon="arrow_forward">
 *   Initialize Session
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      rightIcon,
      leftIcon,
      loading = false,
      fullWidth = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(
          "group uppercase tracking-tight font-display",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          isDisabled && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {/* Stripes overlay for primary variant */}
        {variant === "primary" && (
          <div className="absolute inset-0 w-full h-full bg-stripes opacity-10 pointer-events-none" />
        )}

        {/* Content */}
        <div className="relative flex items-center justify-between gap-2">
          {/* Left icon */}
          {leftIcon && !loading && (
            <Icon
              name={leftIcon}
              size={18}
              className="transition-transform duration-300"
            />
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}

          {/* Label */}
          <span className="flex-1 text-center">{children}</span>

          {/* Right icon */}
          {rightIcon && !loading && (
            <Icon
              name={rightIcon}
              size={18}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          )}
        </div>

        {/* Bottom accent line for primary */}
        {variant === "primary" && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary group-hover:bg-white transition-colors" />
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
