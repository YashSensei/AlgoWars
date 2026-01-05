"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlassPanel, Button, Icon } from "@/components/ui";
import { formatTime } from "@/lib/utils";
import type { Problem, Verdict, Submission } from "@/lib/api/types";

// Mock problem for development
const mockProblem: Problem = {
  id: "1",
  title: "Two Sum",
  difficulty: "easy",
  description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
  inputFormat: `The first line contains two integers n and target (1 ≤ n ≤ 10^4, -10^9 ≤ target ≤ 10^9).
The second line contains n space-separated integers representing the array nums.`,
  outputFormat: `Output two space-separated integers representing the indices of the two numbers.`,
  constraints: `• 2 ≤ nums.length ≤ 10^4
• -10^9 ≤ nums[i] ≤ 10^9
• -10^9 ≤ target ≤ 10^9
• Only one valid answer exists.`,
  sampleInput: `4 9
2 7 11 15`,
  sampleOutput: `0 1`,
  timeLimit: 1000,
  memoryLimit: 256,
  createdAt: new Date().toISOString(),
};

// Mock opponent data
const mockOpponent = {
  username: "CodeNinja",
  rating: 1450,
  submissionCount: 0,
  status: "coding" as const,
};

type OpponentStatus = "coding" | "submitted" | "accepted" | "failed";

const MATCH_DURATION = 30 * 60; // 30 minutes in seconds

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();

  // Match state
  const [timeRemaining, setTimeRemaining] = useState(MATCH_DURATION);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<Partial<Submission>[]>([]);

  // Opponent state (would come from Socket.IO)
  const [opponent] = useState(mockOpponent);
  const [opponentStatus] = useState<OpponentStatus>("coding");

  // Timer effect
  useEffect(() => {
    if (timeRemaining <= 0) {
      // Time's up - redirect to results
      router.push(`/results/${params.id}`);
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, params.id, router]);

  // Handle code submission
  const handleSubmit = async () => {
    if (!code.trim() || isSubmitting) return;

    setIsSubmitting(true);

    // Simulate submission (would be API call + Socket.IO)
    const newSubmission: Partial<Submission> = {
      id: crypto.randomUUID(),
      code,
      language,
      verdict: "pending",
      submittedAt: new Date().toISOString(),
    };

    setSubmissions((prev) => [newSubmission, ...prev]);

    // Simulate AI judge response after 2 seconds
    setTimeout(() => {
      const verdicts: Verdict[] = ["accepted", "wrong_answer", "time_limit", "runtime_error"];
      const randomVerdict = verdicts[Math.floor(Math.random() * verdicts.length)];

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === newSubmission.id
            ? { ...s, verdict: randomVerdict, executionTime: Math.random() * 500 }
            : s
        )
      );
      setIsSubmitting(false);

      // If accepted, redirect to results after brief delay
      if (randomVerdict === "accepted") {
        setTimeout(() => router.push(`/results/${params.id}`), 1500);
      }
    }, 2000);
  };

  // Handle surrender
  const handleSurrender = () => {
    if (confirm("Are you sure you want to surrender? This will count as a loss.")) {
      router.push(`/results/${params.id}?surrendered=true`);
    }
  };

  // Get verdict styling
  const getVerdictStyle = (verdict: Verdict) => {
    switch (verdict) {
      case "accepted":
        return "text-green-400 bg-green-400/10 border-green-400/30";
      case "wrong_answer":
        return "text-red-400 bg-red-400/10 border-red-400/30";
      case "time_limit":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
      case "runtime_error":
        return "text-orange-400 bg-orange-400/10 border-orange-400/30";
      case "compile_error":
        return "text-purple-400 bg-purple-400/10 border-purple-400/30";
      default:
        return "text-text-muted bg-white/5 border-white/10";
    }
  };

  const getVerdictLabel = (verdict: Verdict) => {
    switch (verdict) {
      case "accepted":
        return "Accepted";
      case "wrong_answer":
        return "Wrong Answer";
      case "time_limit":
        return "Time Limit";
      case "runtime_error":
        return "Runtime Error";
      case "compile_error":
        return "Compile Error";
      default:
        return "Judging...";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)]">
      {/* Top Bar - Timer & Match Info */}
      <div className="flex-shrink-0 border-b border-border-dark bg-card-dark/50 backdrop-blur-sm px-4 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          {/* Left - Problem Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                  mockProblem.difficulty === "easy"
                    ? "bg-green-400/20 text-green-400"
                    : mockProblem.difficulty === "medium"
                      ? "bg-yellow-400/20 text-yellow-400"
                      : "bg-red-400/20 text-red-400"
                }`}
              >
                {mockProblem.difficulty}
              </span>
              <h1 className="text-white font-bold">{mockProblem.title}</h1>
            </div>
          </div>

          {/* Center - Timer */}
          <div className="flex flex-col items-center">
            <div
              className={`text-3xl font-mono font-bold tabular-nums tracking-wider ${
                timeRemaining < 60
                  ? "text-red-400 animate-pulse"
                  : timeRemaining < 300
                    ? "text-yellow-400"
                    : "text-white"
              }`}
            >
              {formatTime(timeRemaining)}
            </div>
            <span className="text-[10px] text-text-muted uppercase tracking-wider">
              Time Remaining
            </span>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="danger"
              size="sm"
              leftIcon="flag"
              onClick={handleSurrender}
            >
              Surrender
            </Button>
          </div>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-0 overflow-hidden">
        {/* Left Column - Problem Description */}
        <div className="border-r border-border-dark overflow-y-auto bg-bg-dark/50">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Icon name="description" size={20} className="text-primary" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                Problem
              </h2>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Description
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                {mockProblem.description}
              </p>
            </div>

            {/* Input Format */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Input Format
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                {mockProblem.inputFormat}
              </p>
            </div>

            {/* Output Format */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Output Format
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                {mockProblem.outputFormat}
              </p>
            </div>

            {/* Constraints */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Constraints
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed font-mono">
                {mockProblem.constraints}
              </p>
            </div>

            {/* Sample I/O */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Sample Input
              </h3>
              <pre className="p-3 bg-input-bg border border-border-dark rounded text-sm text-white font-mono overflow-x-auto">
                {mockProblem.sampleInput}
              </pre>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Sample Output
              </h3>
              <pre className="p-3 bg-input-bg border border-border-dark rounded text-sm text-white font-mono overflow-x-auto">
                {mockProblem.sampleOutput}
              </pre>
            </div>

            {/* Limits */}
            <div className="flex gap-4 text-xs text-text-muted">
              <div className="flex items-center gap-1">
                <Icon name="schedule" size={14} />
                <span>Time: {mockProblem.timeLimit}ms</span>
              </div>
              <div className="flex items-center gap-1">
                <Icon name="memory" size={14} />
                <span>Memory: {mockProblem.memoryLimit}MB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column - Code Editor */}
        <div className="flex flex-col border-r border-border-dark overflow-hidden bg-bg-dark">
          {/* Editor Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-dark bg-card-dark/30">
            <div className="flex items-center gap-3">
              <Icon name="code" size={20} className="text-primary" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                Solution
              </h2>
            </div>

            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-input-bg border border-border-dark rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </select>
          </div>

          {/* Code Textarea (placeholder for Monaco/CodeMirror) */}
          <div className="flex-1 relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="// Write your solution here..."
              spellCheck={false}
              className="w-full h-full p-4 bg-transparent text-white font-mono text-sm resize-none focus:outline-none placeholder:text-white/20 leading-relaxed"
              style={{ tabSize: 2 }}
            />
          </div>

          {/* Submit Bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border-dark bg-card-dark/30">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Icon name="info" size={14} />
              <span>
                Submissions: {submissions.length} / 10
              </span>
            </div>
            <Button
              variant="primary"
              size="md"
              leftIcon="send"
              onClick={handleSubmit}
              disabled={!code.trim() || isSubmitting}
              className="min-w-[140px]"
            >
              {isSubmitting ? "Judging..." : "Submit"}
            </Button>
          </div>
        </div>

        {/* Right Column - Opponent & Submissions */}
        <div className="overflow-y-auto bg-bg-dark/50">
          <div className="p-6">
            {/* Opponent Status */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="person" size={20} className="text-primary" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                  Opponent
                </h2>
              </div>

              <GlassPanel padding="p-4" className="border border-border-dark">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="size-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Icon name="person" size={24} className="text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="text-white font-bold">{opponent.username}</div>
                    <div className="text-xs text-text-muted font-mono">
                      Rating: {opponent.rating}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted uppercase tracking-wider">
                      Status
                    </span>
                    <div
                      className={`flex items-center gap-2 text-sm font-bold ${
                        opponentStatus === "coding"
                          ? "text-blue-400"
                          : opponentStatus === "accepted"
                            ? "text-green-400"
                            : opponentStatus === "submitted"
                              ? "text-yellow-400"
                              : "text-red-400"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          opponentStatus === "coding"
                            ? "bg-blue-400"
                            : opponentStatus === "accepted"
                              ? "bg-green-400"
                              : opponentStatus === "submitted"
                                ? "bg-yellow-400"
                                : "bg-red-400"
                        } animate-pulse`}
                      />
                      {opponentStatus === "coding"
                        ? "Coding..."
                        : opponentStatus === "accepted"
                          ? "Solved!"
                          : opponentStatus === "submitted"
                            ? "Judging..."
                            : "Failed"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-text-muted uppercase tracking-wider">
                      Submissions
                    </span>
                    <span className="text-sm text-white font-mono">
                      {opponent.submissionCount}
                    </span>
                  </div>
                </div>
              </GlassPanel>
            </div>

            {/* Your Submissions */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Icon name="history" size={20} className="text-primary" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                  Your Submissions
                </h2>
              </div>

              {submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Icon name="code_off" size={32} className="text-white/10 mb-3" />
                  <p className="text-text-muted text-sm">No submissions yet</p>
                  <p className="text-text-muted text-xs">
                    Write your solution and submit
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {submissions.map((submission, index) => (
                    <div
                      key={submission.id}
                      className={`p-3 rounded border ${getVerdictStyle(submission.verdict as Verdict)}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono">
                          #{submissions.length - index}
                        </span>
                        <span className="text-xs font-bold uppercase">
                          {getVerdictLabel(submission.verdict as Verdict)}
                        </span>
                      </div>
                      {submission.executionTime && (
                        <div className="mt-1 text-xs opacity-70">
                          {submission.executionTime.toFixed(0)}ms
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
