// Socket.IO setup - Phase 7
// Will handle: match rooms, real-time events

export const SOCKET_EVENTS = {
  // Client -> Server
  MATCH_JOIN: "match:join",
  MATCH_LEAVE: "match:leave",

  // Server -> Client
  QUEUE_MATCHED: "queue:matched",
  MATCH_COUNTDOWN: "match:countdown",
  MATCH_START: "match:start",
  MATCH_SUBMISSION: "match:submission",
  MATCH_END: "match:end",
} as const;
