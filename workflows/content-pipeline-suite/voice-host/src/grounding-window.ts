export type TranscriptTurn = {
  role?: string;
  content?: string;
  text?: string;
};

export function ownerSlice(turns: TranscriptTurn[] | undefined, fromIndex: number, toIndex?: number): string {
  const list = Array.isArray(turns) ? turns : [];
  const end = toIndex == null ? list.length : toIndex;
  const slice = list.slice(fromIndex, end);
  return slice
    .filter((turn) => String(turn.role || "").toLowerCase() === "user")
    .map((turn) => String(turn.content || turn.text || "").trim())
    .filter(Boolean)
    .join(" ");
}

export function latestOwnerTurn(turns: TranscriptTurn[] | undefined): string {
  const list = Array.isArray(turns) ? turns : [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (String(list[i].role || "").toLowerCase() === "user") {
      return String(list[i].content || list[i].text || "").trim();
    }
  }
  return "";
}

export const AFFIRMATIVE = [
  "yes",
  "yeah",
  "yep",
  "sure",
  "okay",
  "ok",
  "go ahead",
  "i agree",
  "that's fine",
  "thats fine",
];

export function hasAffirmative(text: string): boolean {
  const lower = String(text || "").toLowerCase();
  if (/\bnot sure\b/.test(lower)) return false;
  return AFFIRMATIVE.some((token) => {
    if (token.includes(" ")) return lower.includes(token);
    return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower);
  });
}
