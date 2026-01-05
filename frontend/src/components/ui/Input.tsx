"use client";

import { cn } from "@/lib/utils";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Label text above the input */
  label?: string;
  /** Icon name (Material Symbols) for the left icon box */
  icon?: string;
  /** Error message to display */
  error?: string;
  /** Right-side action element (e.g., "Recovery Protocol?" link) */
  rightAction?: React.ReactNode;
  /** Show password toggle for password inputs */
  showPasswordToggle?: boolean;
}

/**
 * Input component matching the design system
 * Features icon box on left, bottom border, focus states
 *
 * @example
 * <Input
 *   label="Operator Handle"
 *   icon="fingerprint"
 *   placeholder="USER_ID"
 *   type="text"
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      icon,
      error,
      rightAction,
      showPasswordToggle,
      type = "text",
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;

    return (
      <div className="flex flex-col gap-1.5 input-group group">
        {/* Label row */}
        {(label || rightAction) && (
          <div className="flex justify-between items-center">
            {label && (
              <label className="label-style transition-colors duration-300 group-focus-within:text-primary">
                {label}
              </label>
            )}
            {rightAction}
          </div>
        )}

        {/* Input container */}
        <div className="relative flex items-center">
          {/* Icon box */}
          {icon && (
            <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center input-icon-box transition-colors duration-300 group-focus-within:text-primary group-focus-within:border-primary">
              <Icon name={icon} size={18} className="text-gray-500 transition-colors group-focus-within:text-primary" />
            </div>
          )}

          {/* Input field */}
          <input
            ref={ref}
            type={inputType}
            className={cn(
              "w-full input-field text-white text-sm font-mono",
              "placeholder:text-gray-700",
              icon ? "pl-12" : "pl-4",
              isPassword && showPasswordToggle ? "pr-10" : "pr-4",
              "py-3",
              error && "border-red-500 focus:border-red-500",
              className
            )}
            {...props}
          />

          {/* Password toggle */}
          {isPassword && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center text-gray-600 hover:text-white cursor-pointer transition-colors"
            >
              <Icon
                name={showPassword ? "visibility" : "visibility_off"}
                size={18}
              />
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <span className="text-xs text-red-500 mt-1">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
