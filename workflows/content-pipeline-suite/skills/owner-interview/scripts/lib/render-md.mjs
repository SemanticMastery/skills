/**
 * Render an interview pack JSON as a fillable markdown form.
 */

import { estimateMinutes } from "./estimate.mjs";

export function renderPackMarkdown(pack) {
  const scope = pack?.scope || "pack";
  const questions = pack?.questions || [];
  const minutes = estimateMinutes(questions.length);
  const lines = [
    `# Owner interview — ${scope}`,
    "",
    `Time budget: about ${minutes} minute${minutes === 1 ? "" : "s"}`,
    "",
  ];

  questions.forEach((question, index) => {
    lines.push(`## ${index + 1}. ${question.prompt || ""}`);
    lines.push("");
    lines.push(`[${question.type} · ${question.pd_field} · ${question.grid_row}]`);
    lines.push("");
    if (question.claim?.text) {
      lines.push(`Claim (${question.claim.source || "source"}): ${question.claim.text}`);
      lines.push("");
    }
    if (question.followup) {
      lines.push(`Follow-up: ${question.followup}`);
      lines.push("");
    }
    lines.push("Answer: ________________");
    lines.push("");
  });

  return lines.join("\n");
}
