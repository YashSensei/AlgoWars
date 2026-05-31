export const AVATARS = [
  { id: "bug_hunter.png", name: "Bug Hunter" },
  { id: "data_titan.png", name: "Data Titan" },
  { id: "quantom_hacker.png", name: "Quantum Hacker" },
  { id: "runtine_rouge.png", name: "Runtime Rogue" },
  { id: "stack_samurai.png", name: "Stack Samurai" },
  { id: "syntax_sage.png", name: "Syntax Sage" },
] as const;

export function getAvatarUrl(filename: string): string {
  return `/avatars/${filename}`;
}
