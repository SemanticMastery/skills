#!/usr/bin/env node
/**
 * Create and update an owner-interview record from confirmed answers.
 *
 * Usage:
 *   node interview-record.mjs --campaign-dir "..." --create --scope deep-root-fertilization
 *   node interview-record.mjs --campaign-dir "..." --scope deep-root-fertilization --add-answer '<json>'
 *   node interview-record.mjs --campaign-dir "..." --scope deep-root-fertilization --mark-unanswered --question-id <id>
 *   node interview-record.mjs --campaign-dir "..." --scope deep-root-fertilization --set-state captured
 *   node interview-record.mjs --campaign-dir "..." --scope deep-root-fertilization --set-source-id PD-SRC-002
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { fail, parseArgs } from "./lib/args.mjs";
import { requireCampaign, resolveCampaignDir } from "./lib/paths.mjs";
import {
  addAnswer,
  createRecord,
  listFlaggedForScope,
  markUnanswered,
  reviewFact,
  setSourceId,
  setState,
} from "./lib/record.mjs";

export { createRecord };

export function main(argv = process.argv) {
  const args = parseArgs(argv, {
    actions: [
      "create",
      "addAnswer",
      "markUnanswered",
      "questionId",
      "setState",
      "setSourceId",
      "listFlagged",
      "review",
      "fact",
      "clear",
      "edit",
      "drop",
    ],
  });
  if (args.foreignFlag) fail("foreign_flag", { flag: args.foreignFlag });
  if (args.help) {
    console.log(
      "usage: interview-record.mjs --campaign-dir <abs> --scope <offering-slug|company> (--create | --add-answer <json> | --mark-unanswered --question-id <id> | --set-state <state> | --set-source-id <id> | --list-flagged | --review --question-id <id> --fact <n> (--clear | --edit <text> | --drop))",
    );
    return;
  }
  if (args.unknown) fail("unknown_flag", { flag: args.unknown });
  const campaignDir = resolveCampaignDir(args);
  requireCampaign(campaignDir);
  if (!args.scope) fail("scope_required");

  let result;
  if (args.create) {
    result = createRecord({ campaignDir, scope: args.scope });
  } else if (args.addAnswer !== undefined) {
    result = addAnswer({
      campaignDir,
      scope: args.scope,
      answerInput: args.addAnswer,
    });
  } else if (args.markUnanswered) {
    result = markUnanswered({
      campaignDir,
      scope: args.scope,
      questionId: args.questionId,
    });
  } else if (args.setSourceId !== undefined) {
    result = setSourceId({
      campaignDir,
      scope: args.scope,
      sourceId: args.setSourceId,
    });
  } else if (args.setState !== undefined) {
    result = setState({
      campaignDir,
      scope: args.scope,
      state: args.setState,
    });
  } else if (args.listFlagged) {
    result = listFlaggedForScope({ campaignDir, scope: args.scope });
  } else if (args.review) {
    result = reviewFact({
      campaignDir,
      scope: args.scope,
      questionId: args.questionId,
      factIndex: args.fact,
      clear: Boolean(args.clear),
      edit: args.edit,
      drop: Boolean(args.drop),
    });
  } else {
    fail("action_required");
  }

  if (result?.error) fail(result.error, result.extra || {});
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
