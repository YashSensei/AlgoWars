/**
 * Submissions API functions
 */
import api from "./client";
import type {
  SubmissionRequest,
  SubmissionResponse,
  SubmissionStatusResponse,
  Submission,
} from "./types";

export const submissionsApi = {
  /**
   * Submit code for judging
   */
  submit: (data: SubmissionRequest) =>
    api.post<SubmissionResponse>("/submissions", data),

  /**
   * Get current submission status (polling)
   */
  getStatus: () => api.get<SubmissionStatusResponse>("/submissions/status"),

  /**
   * Get specific submission by ID
   */
  getSubmission: (submissionId: string) =>
    api.get<Submission>(`/submissions/${submissionId}`),
};
