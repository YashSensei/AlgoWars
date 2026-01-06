"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  GlassPanel,
  Button,
  Icon,
  CodeEditor,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui";
import { useUser } from "@/stores";
import { formatTime } from "@/lib/utils";
import { matchesApi, submissionsApi, ApiClientError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type {
  Match,
  Language,
  MatchSubmissionEvent,
  MatchEndEvent,
} from "@/lib/api/types";

type MatchState = "loading" | "active" | "submitting" | "ended" | "error";
type OpponentStatus = "coding" | "submitted" | "accepted" | "disconnected";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "python3", label: "Python 3" },
  { value: "cpp17", label: "C++ 17" },
  { value: "cpp20", label: "C++ 20" },
  { value: "java17", label: "Java 17" },
  { value: "pypy3", label: "PyPy 3" },
];

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const user = useUser();
  const matchId = params.id as string;

  // Match state
  const [matchState, setMatchState] = useState<MatchState>("loading");
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Timer
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Editor state
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language>("python3");

  // Submission state
  const [submissions, setSubmissions] = useState<
    { id: string; verdict: string; time?: number }[]
  >([]);
  const [currentVerdict, setCurrentVerdict] = useState<string | null>(null);

  // Opponent state
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);
  const [opponentStatus, setOpponentStatus] = useState<OpponentStatus>("coding");
  const [opponentSubmissions, setOpponentSubmissions] = useState(0);

  // Load match data on mount
  useEffect(() => {
    let mounted = true;

    const loadMatch = async () => {
      try {
        const matchData = await matchesApi.getMatch(matchId);

        if (!mounted) return;

        setMatch(matchData);

        // Find opponent
        const opponentPlayer = matchData.players.find((p) => p.user.id !== user?.id);
        if (opponentPlayer) {
          setOpponent(opponentPlayer.user);
        }

        // Calculate time remaining
        if (matchData.startedAt) {
          const startTime = new Date(matchData.startedAt).getTime();
          const endTime = startTime + matchData.duration * 1000;
          const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          setTimeRemaining(remaining);
        } else {
          setTimeRemaining(matchData.duration);
        }

        // Start match if needed
        if (matchData.status === "WAITING" || matchData.status === "STARTING") {
          await matchesApi.startMatch(matchId);
        }

        setMatchState("active");
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof ApiClientError ? err.message : "Failed to load match";
        setError(message);
        setMatchState("error");
      }
    };

    loadMatch();

    return () => {
      mounted = false;
    };
  }, [matchId, user?.id]);

  // Setup socket listeners when active
  useEffect(() => {
    if (matchState !== "active") return;

    const socket = getSocket();

    // Join match room
    socket.emit("match:join", { matchId });

    // Opponent submission
    const handleSubmission = (data: MatchSubmissionEvent) => {
      if (data.userId !== user?.id) {
        setOpponentSubmissions((prev) => prev + 1);
        if (data.verdict === "ACCEPTED") {
          setOpponentStatus("accepted");
        } else {
          setOpponentStatus("submitted");
          setTimeout(() => setOpponentStatus("coding"), 2000);
        }
      }
    };

    // Match ended
    const handleEnd = (data: MatchEndEvent) => {
      setMatchState("ended");
      router.push(`/results/${matchId}?winner=${data.winnerId}&reason=${data.reason}`);
    };

    // Opponent disconnected
    const handleDisconnect = () => {
      setOpponentStatus("disconnected");
    };

    // Opponent reconnected
    const handleReconnect = () => {
      setOpponentStatus("coding");
    };

    socket.on("match:submission", handleSubmission);
    socket.on("match:end", handleEnd);
    socket.on("opponent:disconnected", handleDisconnect);
    socket.on("opponent:reconnected", handleReconnect);

    return () => {
      socket.emit("match:leave", { matchId });
      socket.off("match:submission", handleSubmission);
      socket.off("match:end", handleEnd);
      socket.off("opponent:disconnected", handleDisconnect);
      socket.off("opponent:reconnected", handleReconnect);
    };
  }, [matchState, matchId, user?.id, router]);

  // Timer countdown
  useEffect(() => {
    if (matchState !== "active" || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          router.push(`/results/${matchId}?reason=timeout`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [matchState, timeRemaining, matchId, router]);

  // Handle code submission
  const handleSubmit = async () => {
    if (!code.trim() || matchState === "submitting") return;

    setMatchState("submitting");
    setCurrentVerdict(null);

    try {
      const response = await submissionsApi.submit({
        matchId,
        code,
        language,
      });

      const newSubmission = {
        id: response.submissionId,
        verdict: response.verdict,
      };
      setSubmissions((prev) => [newSubmission, ...prev]);
      setCurrentVerdict(response.verdict);

      if (response.matchEnded) {
        router.push(`/results/${matchId}?winner=${response.winnerId}`);
      } else {
        setMatchState("active");
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Submission failed";
      setError(message);
      setMatchState("active");
    }
  };

  // Handle surrender
  const handleSurrender = async () => {
    if (!confirm("Are you sure you want to surrender? This will count as a loss.")) {
      return;
    }

    try {
      await matchesApi.forfeitMatch(matchId);
      router.push(`/results/${matchId}?reason=forfeit`);
    } catch (err) {
      console.error("Forfeit failed:", err);
    }
  };

  // Get verdict styling
  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case "ACCEPTED":
        return "text-green-400 bg-green-400/10 border-green-400/30";
      case "WRONG_ANSWER":
        return "text-red-400 bg-red-400/10 border-red-400/30";
      case "TIME_LIMIT":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
      case "RUNTIME_ERROR":
        return "text-orange-400 bg-orange-400/10 border-orange-400/30";
      case "COMPILE_ERROR":
        return "text-purple-400 bg-purple-400/10 border-purple-400/30";
      default:
        return "text-text-muted bg-white/5 border-white/10";
    }
  };

  const getVerdictLabel = (verdict: string) => {
    return verdict.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Format problem statement for display
  const formatProblemStatement = (statement: string | undefined) => {
    if (!statement) return "<p>Loading problem statement...</p>";

    // Convert common patterns to styled HTML
    const formatted = statement
      // Preserve newlines by converting to <br> tags
      .replace(/\n/g, "<br />")
      // Bold section headers like "Input:", "Output:", "Example:"
      .replace(
        /\b(Input|Output|Example|Sample|Note|Constraints|Explanation)s?:/gi,
        '<strong class="text-primary">$1:</strong>'
      )
      // Style input/output blocks (lines starting with numbers or specific patterns)
      .replace(
        /<br \/>([\d\s\-]+)<br \/>/g,
        '<br /><code class="bg-white/5 px-2 py-1 rounded text-accent-gold">$1</code><br />'
      );

    return formatted;
  };

  // Loading state
  if (matchState === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted">Loading match...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (matchState === "error") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Icon name="error" size={48} className="text-red-400" />
          <p className="text-red-400">{error}</p>
          <Button variant="secondary" onClick={() => router.push("/arena")}>
            Back to Arena
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Top Bar - Timer & Match Info */}
      <div className="flex-shrink-0 border-b border-border-dark bg-card-dark/50 backdrop-blur-sm px-4 py-2">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          {/* Left - Problem Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                  (match?.problem.difficulty ?? 0) < 1200
                    ? "bg-green-400/20 text-green-400"
                    : (match?.problem.difficulty ?? 0) < 1600
                      ? "bg-yellow-400/20 text-yellow-400"
                      : "bg-red-400/20 text-red-400"
                }`}
              >
                {match?.problem.difficulty ?? "?"}
              </span>
              <h1 className="text-white font-bold text-sm">{match?.problem.title ?? "Loading..."}</h1>
            </div>
          </div>

          {/* Center - Timer */}
          <div className="flex items-center gap-3">
            <Icon name="schedule" size={20} className="text-text-muted" />
            <div
              className={`text-2xl font-mono font-bold tabular-nums tracking-wider ${
                timeRemaining < 60
                  ? "text-red-400 animate-pulse"
                  : timeRemaining < 300
                    ? "text-yellow-400"
                    : "text-white"
              }`}
            >
              {formatTime(timeRemaining)}
            </div>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-3">
            <Button variant="danger" size="sm" leftIcon="flag" onClick={handleSurrender}>
              Surrender
            </Button>
          </div>
        </div>
      </div>

      {/* Main 3-Panel Resizable Layout */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Left Panel - Problem Description */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <div className="h-full flex flex-col bg-bg-dark/50">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border-dark">
              <Icon name="description" size={18} className="text-primary" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wide">Problem</h2>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div
                className="text-sm text-white/80 leading-relaxed space-y-4 problem-statement"
                dangerouslySetInnerHTML={{
                  __html: formatProblemStatement(match?.problem.statement),
                }}
              />

              {/* Limits */}
              <div className="flex gap-4 text-xs text-text-muted mt-6 pt-4 border-t border-border-dark">
                <div className="flex items-center gap-1">
                  <Icon name="schedule" size={14} />
                  <span>Time: {match?.problem.timeLimit ?? 1000}ms</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="memory" size={14} />
                  <span>Memory: {match?.problem.memoryLimit ?? 256}MB</span>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel - Code Editor */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <div className="h-full flex flex-col bg-bg-dark">
            {/* Editor Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-border-dark bg-card-dark/30">
              <div className="flex items-center gap-3">
                <Icon name="code" size={18} className="text-primary" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wide">Solution</h2>
              </div>

              {/* Language Selector */}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-input-bg border border-border-dark rounded px-3 py-1 text-xs text-white focus:outline-none focus:border-primary"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Monaco Editor */}
            <CodeEditor
              value={code}
              onChange={setCode}
              language={language}
              className="flex-1 min-h-0"
            />

            {/* Verdict Display */}
            {currentVerdict && (
              <div
                className={`flex-shrink-0 px-4 py-2 text-center text-sm font-bold uppercase border-t ${getVerdictStyle(currentVerdict)}`}
              >
                {getVerdictLabel(currentVerdict)}
              </div>
            )}

            {/* Submit Bar - Always visible at bottom */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border-dark bg-card-dark/50">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Icon name="info" size={14} />
                <span>Submissions: {submissions.length}</span>
              </div>
              <Button
                variant="primary"
                size="md"
                leftIcon="send"
                onClick={handleSubmit}
                disabled={!code.trim() || matchState === "submitting"}
                className="min-w-[140px]"
              >
                {matchState === "submitting" ? "Judging..." : "Submit"}
              </Button>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Opponent & Submissions */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
          <div className="h-full flex flex-col bg-bg-dark/50 overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Opponent Status */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="person" size={18} className="text-primary" />
                  <h2 className="text-xs font-bold text-white uppercase tracking-wide">Opponent</h2>
                </div>

                <GlassPanel padding="p-3" className="border border-border-dark">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                      <Icon name="person" size={20} className="text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm truncate">
                        {opponent?.username ?? "Opponent"}
                      </div>
                      <div
                        className={`flex items-center gap-1.5 text-xs ${
                          opponentStatus === "coding"
                            ? "text-blue-400"
                            : opponentStatus === "accepted"
                              ? "text-green-400"
                              : opponentStatus === "disconnected"
                                ? "text-gray-400"
                                : "text-yellow-400"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full animate-pulse ${
                            opponentStatus === "coding"
                              ? "bg-blue-400"
                              : opponentStatus === "accepted"
                                ? "bg-green-400"
                                : opponentStatus === "disconnected"
                                  ? "bg-gray-400"
                                  : "bg-yellow-400"
                          }`}
                        />
                        {opponentStatus === "coding"
                          ? "Coding..."
                          : opponentStatus === "accepted"
                            ? "Solved!"
                            : opponentStatus === "disconnected"
                              ? "Disconnected"
                              : "Judging..."}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">
                      Submissions
                    </span>
                    <span className="text-sm text-white font-mono">{opponentSubmissions}</span>
                  </div>
                </GlassPanel>
              </div>

              {/* Your Submissions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="history" size={18} className="text-primary" />
                  <h2 className="text-xs font-bold text-white uppercase tracking-wide">
                    Your Submissions
                  </h2>
                </div>

                {submissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Icon name="code_off" size={28} className="text-white/10 mb-2" />
                    <p className="text-text-muted text-xs">No submissions yet</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {submissions.map((submission, index) => (
                      <div
                        key={submission.id}
                        className={`p-2.5 rounded border text-xs ${getVerdictStyle(submission.verdict)}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono">#{submissions.length - index}</span>
                          <span className="font-bold uppercase">
                            {getVerdictLabel(submission.verdict)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
