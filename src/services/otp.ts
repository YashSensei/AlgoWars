/**
 * OTP Verification Service
 * Generates 6-digit codes and holds pending registration data until verified.
 * On verify, returns the stored signup payload so the caller can create the user.
 * Codes expire after 10 minutes. In-memory (lost on restart — user just re-registers).
 */

import { Errors } from "../lib/errors";
import { logger } from "../lib/logger";

export interface PendingSignup {
  username: string;
  email: string;
  password: string;
  code: string;
  expiresAt: number;
  createdAt: number;
  attempts: number;
}

const pendingStore = new Map<string, PendingSignup>();
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000; // 1 code per email per 60 seconds
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const otpService = {
  create(username: string, email: string, password: string): string {
    // Rate limit: don't allow a new code if one was generated < 60s ago
    const existing = pendingStore.get(email);
    if (existing && Date.now() - existing.createdAt < OTP_COOLDOWN_MS) {
      throw Errors.BadRequest("Please wait 60 seconds before requesting a new code");
    }

    const code = generateCode();
    pendingStore.set(email, {
      username,
      email,
      password,
      code,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      createdAt: Date.now(),
      attempts: 0,
    });
    logger.debug("OTP", `Code generated for ${email.slice(0, 5)}***`);
    return code;
  },

  verify(email: string, code: string): PendingSignup | null {
    const entry = pendingStore.get(email);
    if (!entry) return null;

    // Expired
    if (Date.now() > entry.expiresAt) {
      pendingStore.delete(email);
      return null;
    }

    // Brute-force protection: max 5 wrong attempts per code
    if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
      pendingStore.delete(email);
      return null;
    }

    if (entry.code !== code) {
      entry.attempts++;
      return null;
    }

    pendingStore.delete(email);
    return entry;
  },
};
