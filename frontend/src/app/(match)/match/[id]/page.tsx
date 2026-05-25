"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
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
import type { Match, Language, MatchSubmissionEvent, MatchEndEvent } from "@/lib/api/types";

type MatchState = "loading" | "active" | "submitting" | "ended" | "error";
type OpponentStatus = "coding" | "submitted" | "accepted" | "disconnected";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "python3", label: "Python 3" },
  { value: "cpp17", label: "C++ 17" },
  { value: "cpp20", label: "C++ 20" },
  { value: "java17", label: "Java 17" },
  { value: "pypy3", label: "PyPy 3" },
];

function formatProblemStatement(raw: string): string {
  // Strip the metadata header block (title, time/memory limits, input/output source)
  const cleaned = raw.replace(
    /^[A-Z]\d*\..*?\n(?:time limit per test\n.*?\n)?(?:memory limit per test\n.*?\n)?(?:input\n.*?\n)?(?:output\n.*?\n)?/i,
    "",
  );

  let text = cleaned.trim();

  // Escape HTML
  text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // LaTeX text commands — extract content, discard formatting commands
  text = text
    .replace(/\\texttt\{([^}]*)\}/g, '<code class="px-1 py-0.5 bg-white/10 rounded text-[13px] font-mono">$1</code>')
    .replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
    .replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\mathtt\{([^}]*)\}/g, '<code class="px-1 py-0.5 bg-white/10 rounded text-[13px] font-mono">$1</code>')
    .replace(/\\mathrm\{([^}]*)\}/g, "$1")
    .replace(/\\operatorname\{([^}]+)\}/g, "$1")
    .replace(/\\color\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\color\{[^}]*\}/g, "");

  // Math symbols
  text = text
    .replace(/\\min/g, "min")
    .replace(/\\max/g, "max")
    .replace(/\\gcd/g, "gcd")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\Leftarrow/g, "⇐")
    .replace(/\\leftrightarrow/g, "↔")
    .replace(/\\le\b|\\leq\b/g, "≤")
    .replace(/\\ge\b|\\geq\b/g, "≥")
    .replace(/\\ne\b|\\neq\b/g, "≠")
    .replace(/\\ldots|\\dots/g, "…")
    .replace(/\\cdots/g, "⋯")
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "×")
    .replace(/\\infty/g, "∞")
    .replace(/\\pm/g, "±")
    .replace(/\\sum/g, "Σ")
    .replace(/\\prod/g, "Π")
    .replace(/\\sqrt/g, "√")
    .replace(/\\lfloor/g, "⌊")
    .replace(/\\rfloor/g, "⌋")
    .replace(/\\lceil/g, "⌈")
    .replace(/\\rceil/g, "⌉")
    .replace(/\\cap/g, "∩")
    .replace(/\\cup/g, "∪")
    .replace(/\\in\b/g, "∈")
    .replace(/\\subset/g, "⊂")
    .replace(/\\oplus/g, "⊕")
    .replace(/\\bmod/g, "mod")
    .replace(/\\mod/g, "mod")
    .replace(/\\quad/g, " ")
    .replace(/\\;|\\,/g, " ")
    .replace(/\\\\/g, "")
    .replace(/\^(\d)/g, "<sup>$1</sup>")
    .replace(/\^{([^}]+)}/g, "<sup>$1</sup>")
    .replace(/_(\d)/g, "<sub>$1</sub>")
    .replace(/_{([^}]+)}/g, "<sub>$1</sub>");

  // Markdown bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Example input/output blocks — wrap in code-block style containers
  // Detect patterns like "Input:\n<numbers>\nOutput:\n<numbers>" inside Examples section
  text = text.replace(
    /\n(Input:\n)([\s\S]*?)(?=\nOutput:)/g,
    '\n<div class="mt-2 mb-1 text-[11px] text-white/50 uppercase tracking-wider font-semibold">Input</div><pre class="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-green-300 font-mono overflow-x-auto mb-2">$2</pre>',
  );
  text = text.replace(
    /\n(Output:\n)([\s\S]*?)(?=\n\n|\nExample|\n$|$)/g,
    '\n<div class="mt-2 mb-1 text-[11px] text-white/50 uppercase tracking-wider font-semibold">Output</div><pre class="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-blue-300 font-mono overflow-x-auto mb-3">$2</pre>',
  );

  // Section headings
  text = text.replace(
    /^(Input|Output|Note|Examples?)\s*:?\s*$/gm,
    '<h4 class="text-white font-bold text-[13px] uppercase tracking-wide mt-6 mb-3 pb-1.5 border-b border-white/10">$1</h4>',
  );
  text = text.replace(
    /\n(Example \d+:?)/g,
    '\n<div class="text-primary font-bold text-xs uppercase tracking-wider mt-5 mb-2">$1</div>',
  );

  // Paragraphs and line breaks
  text = text.replace(/\n\n+/g, '</p><p class="mb-3">');
  text = text.replace(/\n/g, "<br />");

  return `<div class="problem-content text-white/80 leading-7 text-[14px]"><p class="mb-3">${text}</p></div>`;
}


export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const user = useUser();
  const matchId = params.id as string;

  const [matchState, setMatchState] = useState<MatchState>("loading");
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language>("python3");
  const [submissions, setSubmissions] = useState<{ id: string; verdict: string }[]>([]);
  const [currentVerdict, setCurrentVerdict] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<{ id: string; username: string } | null>(null);
  const [opponentStatus, setOpponentStatus] = useState<OpponentStatus>("coding");
  const [opponentSubmissions, setOpponentSubmissions] = useState(0);
  const [logs, setLogs] = useState<{ time: string; message: string; type: "info" | "success" | "error" | "warning" }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Load match data
  useEffect(() => {
    let mounted = true;
    const loadMatch = async () => {
      try {
        let matchData = await matchesApi.getMatch(matchId);
        if (!mounted) return;
        const opponentPlayer = matchData.players.find((p) => p.user.id !== user?.id);
        if (opponentPlayer) {
          setOpponent(opponentPlayer.user);
          if (matchData.mode === "TIMED") {
            addLog("Solo challenge started", "info");
          } else {
            addLog(`Matched against ${opponentPlayer.user.username}`, "info");
          }
        }
        // If match is still pre-active, trigger the transition, then re-read the
        // authoritative startedAt so both clients share the same end time and
        // don't drift apart by whatever seconds separated their join times.
        if (matchData.status === "WAITING" || matchData.status === "STARTING") {
          await matchesApi.startMatch(matchId);
          matchData = await matchesApi.getMatch(matchId);
          if (!mounted) return;
        }
        setMatch(matchData);
        if (matchData.startedAt) {
          const endTime = new Date(matchData.startedAt).getTime() + matchData.duration * 1000;
          setTimeRemaining(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
        } else {
          setTimeRemaining(matchData.duration);
        }
        addLog("Match started!", "success");
        setMatchState("active");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load match");
        setMatchState("error");
      }
    };
    loadMatch();
    return () => { mounted = false; };
  }, [matchId, user?.id]);

  // Socket listeners
  useEffect(() => {
    if (matchState !== "active") return;
    const socket = getSocket();
    socket.emit("match:join", { matchId });

    const handleSubmission = (data: MatchSubmissionEvent) => {
      if (data.userId !== user?.id) {
        setOpponentSubmissions((prev) => prev + 1);
        if (data.verdict === "ACCEPTED") {
          setOpponentStatus("accepted");
          addLog(`${opponent?.username} solved the problem!`, "error");
        } else {
          setOpponentStatus("submitted");
          addLog(`${opponent?.username} submitted (${data.verdict})`, "warning");
          setTimeout(() => setOpponentStatus("coding"), 2000);
        }
      }
    };
    const handleEnd = (data: MatchEndEvent) => {
      setMatchState("ended");
      addLog("Match ended!", "info");
      router.push(`/results/${matchId}?winner=${data.winnerId}&reason=${data.reason}`);
    };
    const handleDisconnect = () => {
      setOpponentStatus("disconnected");
      addLog(`${opponent?.username} disconnected`, "warning");
    };
    const handleReconnect = () => {
      setOpponentStatus("coding");
      addLog(`${opponent?.username} reconnected`, "info");
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
  }, [matchState, matchId, user?.id, router, opponent?.username]);

  // Timer countdown — compute from real elapsed time each tick so the clock
  // stays accurate even during "submitting" state (which previously paused the timer).
  useEffect(() => {
    if (!match?.startedAt) return;
    const endTime = new Date(match.startedAt).getTime() + match.duration * 1000;

    const tick = () => {
      setTimeRemaining(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [match?.startedAt, match?.duration]);

  // Handle timeout navigation — only if idle (not mid-submission, which has its own navigation)
  useEffect(() => {
    if (matchState === "active" && timeRemaining === 0) {
      router.push(`/results/${matchId}?reason=timeout`);
    }
  }, [matchState, timeRemaining, matchId, router]);

  const handleSubmit = async () => {
    if (!code.trim() || matchState === "submitting") return;
    setMatchState("submitting");
    setCurrentVerdict(null);
    addLog("Submitting code...", "info");
    try {
      const response = await submissionsApi.submit({ matchId, code, language });
      setSubmissions((prev) => [{ id: response.submissionId, verdict: response.verdict }, ...prev]);
      setCurrentVerdict(response.verdict);

      if (response.verdict === "ACCEPTED") {
        addLog("ACCEPTED! You solved it!", "success");
      } else {
        addLog(`${response.verdict.replace(/_/g, " ")}`, "error");
      }

      if (response.matchEnded) {
        router.push(`/results/${matchId}?winner=${response.winnerId}`);
      } else {
        setMatchState("active");
      }
    } catch (err) {
      addLog(err instanceof ApiClientError ? err.message : "Submission failed", "error");
      setMatchState("active");
    }
  };

  const handleSurrender = async () => {
    if (!confirm("Are you sure you want to surrender? This will count as a loss.")) return;
    addLog("Surrendering...", "warning");
    try {
      await matchesApi.forfeitMatch(matchId);
      router.push(`/results/${matchId}?reason=forfeit`);
    } catch (err) {
      console.error("Forfeit failed:", err);
    }
  };

  const getVerdictStyle = (verdict: string) => {
    const styles: Record<string, string> = {
      ACCEPTED: "text-green-400 bg-green-400/10 border-green-400/30",
      WRONG_ANSWER: "text-red-400 bg-red-400/10 border-red-400/30",
      TIME_LIMIT: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
      RUNTIME_ERROR: "text-orange-400 bg-orange-400/10 border-orange-400/30",
      COMPILE_ERROR: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    };
    return styles[verdict] || "text-text-muted bg-white/5 border-white/10";
  };

  const getLogStyle = (type: string) => {
    const styles: Record<string, string> = {
      info: "text-blue-400",
      success: "text-green-400",
      error: "text-red-400",
      warning: "text-yellow-400",
    };
    return styles[type] || "text-text-muted";
  };

  if (matchState === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted">Loading match...</p>
        </div>
      </div>
    );
  }

  if (matchState === "error") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon name="error" size={48} className="text-red-400" />
          <p className="text-red-400">{error}</p>
          <Button variant="secondary" onClick={() => router.push("/arena")}>Back to Arena</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg-dark">
      {/* Top Bar */}
      <div className="flex-shrink-0 h-12 border-b border-border-dark bg-card-dark flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
            (match?.problem.difficulty ?? 0) < 1200 ? "bg-green-500/20 text-green-400" :
            (match?.problem.difficulty ?? 0) < 1600 ? "bg-yellow-500/20 text-yellow-400" :
            "bg-red-500/20 text-red-400"
          }`}>
            {match?.problem.difficulty ?? "?"}
          </span>
          <h1 className="text-white font-semibold text-sm">{match?.problem.title ?? "Loading..."}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="schedule" size={18} className="text-text-muted" />
          <span className={`text-xl font-mono font-bold tabular-nums ${
            timeRemaining < 60 ? "text-red-400 animate-pulse" :
            timeRemaining < 300 ? "text-yellow-400" : "text-white"
          }`}>
            {formatTime(timeRemaining)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {match?.mode === "TIMED" ? (
            <div className="flex items-center gap-2 text-xs">
              <Icon name="timer" size={16} className="text-primary" />
              <span className="text-white font-medium uppercase">Solo Challenge</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="size-7 rounded bg-red-500/10 flex items-center justify-center">
                <Icon name="person" size={16} className="text-red-400" />
              </div>
              <div className="text-xs">
                <div className="text-white font-medium">{opponent?.username ?? "Opponent"}</div>
                <div className={`flex items-center gap-1 ${
                  opponentStatus === "coding" ? "text-blue-400" :
                  opponentStatus === "accepted" ? "text-green-400" :
                  opponentStatus === "disconnected" ? "text-gray-400" : "text-yellow-400"
                }`}>
                  <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  <span>{opponentStatus === "coding" ? "Coding" : opponentStatus === "accepted" ? "Solved!" : opponentStatus === "disconnected" ? "Offline" : "Judging"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - 3 Panel Layout */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Panel 1: Problem Description (Left) */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <div className="h-full flex flex-col bg-card-dark/30 border-r border-border-dark">
              <div className="flex-shrink-0 h-10 border-b border-border-dark bg-card-dark/50 flex items-center px-4">
                <div className="flex items-center gap-2 text-primary">
                  <Icon name="description" size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Problem</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {/* Problem title */}
                <h2 className="text-lg font-bold text-white mb-4 pb-3 border-b border-border-dark">
                  {match?.problem.title ?? "Loading..."}
                </h2>
                <div
                  className="problem-statement"
                  dangerouslySetInnerHTML={{
                    __html: formatProblemStatement(
                      match?.problem.statement ?? "Loading problem statement...",
                    ),
                  }}
                />
                <div className="mt-6 pt-4 border-t border-border-dark">
                  <h3 className="text-xs font-bold text-text-muted uppercase mb-3 tracking-wide">Constraints</h3>
                  <div className="space-y-2 text-xs text-white/70">
                    <div className="flex items-center gap-2">
                      <Icon name="schedule" size={14} className="text-primary" />
                      <span>Time: {match?.problem.timeLimit ?? 1000}ms</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="memory" size={14} className="text-primary" />
                      <span>Memory: {match?.problem.memoryLimit ?? 256}MB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right side: Code Editor + Logs (Vertical Split) */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              {/* Panel 2: Code Editor (Right Top) */}
              <ResizablePanel defaultSize={70} minSize={30}>
                <div className="h-full flex flex-col bg-card-dark/30">
                  <div className="flex-shrink-0 h-10 border-b border-border-dark bg-card-dark/50 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Icon name="code" size={16} />
                      <span className="text-xs font-semibold uppercase tracking-wide">Code</span>
                    </div>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      className="bg-bg-dark border border-border-dark rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>{lang.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-h-0">
                    <CodeEditor value={code} onChange={setCode} language={language} className="h-full" />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Panel 3: Actions + Live Logs (Right Bottom) */}
              <ResizablePanel defaultSize={30} minSize={20}>
                <div className="h-full flex flex-col bg-card-dark/30 border-t border-border-dark">
                  {/* Action Buttons */}
                  <div className="flex-shrink-0 h-14 border-b border-border-dark bg-card-dark/50 flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                      {currentVerdict && (
                        <span className={`px-3 py-1 rounded text-xs font-bold uppercase border ${getVerdictStyle(currentVerdict)}`}>
                          {currentVerdict.replace(/_/g, " ")}
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        Submissions: {submissions.length}
                        {match?.mode !== "TIMED" && opponentSubmissions > 0 && <span className="text-red-400 ml-2">| Opponent: {opponentSubmissions}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon="flag"
                        onClick={handleSurrender}
                      >
                        Surrender
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon="play_arrow"
                        onClick={handleSubmit}
                        disabled={!code.trim() || matchState === "submitting"}
                      >
                        {matchState === "submitting" ? "Judging..." : "Submit"}
                      </Button>
                    </div>
                  </div>

                  {/* Live Logs */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="terminal" size={14} className="text-text-muted" />
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Live Logs</span>
                    </div>
                    <div className="space-y-1 font-mono text-xs">
                      {logs.length === 0 ? (
                        <p className="text-text-muted/50">Waiting for events...</p>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className={`flex gap-2 ${getLogStyle(log.type)}`}>
                            <span className="text-text-muted/50 shrink-0">[{log.time}]</span>
                            <span>{log.message}</span>
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
