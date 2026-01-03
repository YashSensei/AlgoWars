/**
 * Submission Queue Service
 * Ensures only 1 submission is processed at a time
 * Uses AI Judge for PoC (can swap to real judge later)
 */

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
  private currentSubmission: QueuedSubmission | null = null;
  private isJudging = false;

  /**
   * Check if queue is currently processing
   */
  isBusy(): boolean {
    return this.isJudging;
  }

  /**
   * Get current submission info
   */
  getCurrentSubmission(): QueuedSubmission | null {
    return this.currentSubmission;
  }

  /**
   * Submit code for AI judging
   * Returns verdict directly (AI judge is fast)
   */
  async submit(submission: QueuedSubmission): Promise<SubmissionStatus> {
    if (this.isBusy()) {
      return { status: "busy" };
    }

    this.isJudging = true;
    this.currentSubmission = submission;
    const submissionId = `ai-${Date.now()}`;

    try {
      // Call AI judge
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

      this.clearQueue();
      return { status: "complete", submissionId, verdict };
    } catch (err) {
      this.clearQueue();
      const message = err instanceof Error ? err.message : "Unknown error";
      return { status: "complete", submissionId, error: message };
    }
  }

  /**
   * Poll for verdict (for compatibility - AI returns immediately)
   */
  async pollResult(): Promise<SubmissionStatus> {
    if (!this.currentSubmission) {
      return { status: "complete", error: "No active submission" };
    }
    // AI judge returns immediately, so if we're here, it's still processing
    return { status: "judging" };
  }

  /**
   * Clear the queue
   */
  private clearQueue(): void {
    this.currentSubmission = null;
    this.isJudging = false;
  }

  /**
   * Force clear (admin use)
   */
  forceReset(): void {
    this.clearQueue();
  }
}

// Export singleton instance
export const submissionQueue = new SubmissionQueue();
