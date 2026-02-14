/**
 * Submission Queue Service
 * Uses per-user locks to allow concurrent submissions from different users
 * while preventing a single user from spamming submissions
 */

import { logger } from "../lib/logger";
import { judgeCode } from "./ai-judge";

export type Language = "cpp17" | "cpp20" | "python3" | "java17" | "pypy3";

export interface QueuedSubmission {
  userId: string;
  problemId: string;
  problemStatement: string;
  code: string;
  language: Language;
}

export interface VerdictResult {
  verdict: string;
  runtime?: number;
  memory?: number;
  feedback?: string;
  confidence?: number;
  isFinal: boolean;
}

export interface SubmissionStatus {
  status: "queued" | "busy" | "judging" | "complete";
  submissionId?: string;
  verdict?: VerdictResult;
  error?: string;
}

class SubmissionQueue {
  // Per-user active submissions (userId -> submission)
  private activeSubmissions = new Map<string, QueuedSubmission>();

  /**
   * Check if a specific user has an active submission
   */
  isUserBusy(userId: string): boolean {
    return this.activeSubmissions.has(userId);
  }

  /**
   * Get count of active submissions (for monitoring)
   */
  getActiveCount(): number {
    return this.activeSubmissions.size;
  }

  /**
   * Get user's current submission
   */
  getUserSubmission(userId: string): QueuedSubmission | null {
    return this.activeSubmissions.get(userId) ?? null;
  }

  /**
   * Try to acquire lock for a specific user
   */
  private tryAcquireLock(userId: string): boolean {
    if (this.activeSubmissions.has(userId)) return false;
    // Set placeholder to acquire lock
    this.activeSubmissions.set(userId, {} as QueuedSubmission);
    return true;
  }

  /**
   * Release lock for a specific user
   */
  private releaseLock(userId: string): void {
    this.activeSubmissions.delete(userId);
  }

  /**
   * Submit code for AI judging
   * Allows concurrent submissions from different users
   */
  async submit(submission: QueuedSubmission): Promise<SubmissionStatus> {
    // Per-user lock acquisition
    if (!this.tryAcquireLock(submission.userId)) {
      logger.debug(
        "Submission",
        `User ${submission.userId.slice(0, 8)} rejected - already judging`,
      );
      return { status: "busy" };
    }

    // Entire post-lock section wrapped in try/finally to prevent lock leaks
    try {
      this.activeSubmissions.set(submission.userId, submission);
      const submissionId = `ai-${Date.now()}-${submission.userId.slice(0, 8)}`;

      logger.info("Submission", `Processing submission ${submissionId}`, {
        user: submission.userId.slice(0, 8),
        language: submission.language,
        codeLength: submission.code.length,
        activeCount: this.activeSubmissions.size,
      });

      // Call AI judge (can run concurrently for different users)
      const result = await judgeCode(
        submission.problemStatement,
        submission.code,
        submission.language,
      );

      const verdict: VerdictResult = {
        verdict: result.verdict,
        feedback: result.feedback,
        confidence: result.confidence,
        isFinal: true,
      };

      logger.info("Submission", `Verdict: ${result.verdict}`, {
        submissionId,
        confidence: result.confidence,
      });

      return { status: "complete", submissionId, verdict };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error("Submission", `AI judge error`, { error: message });
      return { status: "complete", error: message };
    } finally {
      // Always release lock
      this.releaseLock(submission.userId);
    }
  }

  /**
   * Poll for user's verdict status
   */
  async pollResult(userId: string): Promise<SubmissionStatus> {
    if (!this.activeSubmissions.has(userId)) {
      return { status: "complete", error: "No active submission" };
    }
    return { status: "judging" };
  }

  /**
   * Force clear a user's submission (admin use)
   */
  forceReset(userId?: string): void {
    if (userId) {
      this.activeSubmissions.delete(userId);
    } else {
      this.activeSubmissions.clear();
    }
  }
}

// Export singleton instance
export const submissionQueue = new SubmissionQueue();
