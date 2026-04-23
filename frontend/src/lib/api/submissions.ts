/**
 * Submissions API functions
 */
import api from "./client";
import type { Submission, SubmissionRequest, SubmissionResponse } from "./types";

export const submissionsApi = {
  /**
   * Submit code for judging
   */
  submit: (data: SubmissionRequest) => api.post<SubmissionResponse>("/submissions", data),

  /**
   * Get specific submission by ID
   */
  getSubmission: (submissionId: string) => api.get<Submission>(`/submissions/${submissionId}`),
};
