"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useState } from "react";
import { Button, GlassPanel, Input } from "@/components/ui";
import { useAuthStore, useIsAuthenticated } from "@/stores";

// Validation schema
const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, "Handle must be at least 3 characters")
      .max(32, "Handle must be at most 32 characters")
      .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, underscores, and hyphens"),
    email: z.string().email("Invalid comms channel format"),
    password: z.string().min(8, "Access key must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Access keys do not match",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { register: registerUser, loginWithOAuth, isLoading, error, clearError } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/arena");
    }
  }, [isAuthenticated, router]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const onSubmit = async (data: SignupForm) => {
    const message = await registerUser(data.username, data.email, data.password);
    if (message) {
      setVerifyMessage(message);
    }
  };

  return (
    <div className="w-full max-w-[420px] flex flex-col gap-6 relative">
      {/* Rotating geometric decoration */}
      <div className="absolute -top-12 -right-8 w-24 h-24 border border-white/5 rounded-full flex items-center justify-center animate-slow-spin pointer-events-none hidden md:flex">
        <div className="w-20 h-20 border-t border-b border-primary/20 rounded-full" />
      </div>

      {/* Main Panel */}
      <GlassPanel showCornerAccents>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-baseline justify-between mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight uppercase">
              New Operator
            </h1>
            <span className="text-xs font-japanese text-primary">登録</span>
          </div>
          <p className="text-text-muted text-xs tracking-wide">
            Register to enter the competitive arena.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-black/40 rounded mb-8 border border-white/5">
          <Link
            href="/login"
            className="py-2 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-white transition-colors text-center"
          >
            Login
          </Link>
          <button className="py-2 text-xs font-bold uppercase tracking-wider text-white bg-border-dark rounded shadow-sm transition-all">
            Sign Up
          </button>
        </div>

        {/* Email verification message */}
        {verifyMessage && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded">
            <p className="text-green-400 text-xs font-bold uppercase tracking-wide mb-1">Registration Complete</p>
            <p className="text-green-300/80 text-xs">{verifyMessage}</p>
            <Link href="/login" className="text-primary text-xs hover:underline mt-2 inline-block">
              Go to Login
            </Link>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Input
            label="Operator Handle"
            icon="fingerprint"
            placeholder="UNIQUE_ID"
            error={errors.username?.message}
            {...register("username")}
          />

          <Input
            label="Comms Channel"
            icon="mail"
            type="email"
            placeholder="operator@domain.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            label="Access Key"
            icon="encrypted"
            type="password"
            placeholder="••••••••••••"
            showPasswordToggle
            error={errors.password?.message}
            {...register("password")}
          />

          <Input
            label="Confirm Access Key"
            icon="lock"
            type="password"
            placeholder="••••••••••••"
            showPasswordToggle
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            rightIcon="arrow_forward"
            loading={isLoading}
            className="mt-2"
          >
            Create Identity
          </Button>
        </form>

        {/* Divider */}
        <div className="relative flex py-8 items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-dark" />
          </div>
          <span className="relative bg-card-dark px-2 text-[10px] text-gray-600 uppercase tracking-widest font-mono">
            Or authenticate via
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-1 gap-3">
          {/* Google */}
          <button
            type="button"
            onClick={() => loginWithOAuth("google")}
            className="flex items-center justify-center gap-2 bg-transparent border border-border-dark hover:border-white/30 hover:bg-white/5 text-white py-2.5 transition-all group"
          >
            <svg
              className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all opacity-70 group-hover:opacity-100"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">
              GOOGLE
            </span>
          </button>
        </div>
      </GlassPanel>

      {/* Footer text */}
      <div className="text-center">
        <p className="text-gray-600 text-[10px] uppercase tracking-wide">
          Encrypted Connection <span className="text-green-500">•</span> Secure
          V2.1
        </p>
      </div>
    </div>
  );
}
