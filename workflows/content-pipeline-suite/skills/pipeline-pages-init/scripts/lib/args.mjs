export function parseArgs(argv, defaults = {}) {
  const out = { help: false, ...defaults };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--campaign-dir") out.campaignDir = argv[++i];
    else if (a === "--pipeline-dir") out.pipelineDir = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--write") out.write = true;
    else if (a === "--write-projection") out.writeProjection = true;
    else if (a === "--decide") {
      out.decideSlug = argv[++i];
      out.decideValue = argv[++i];
    } else if (a === "--set-seed") {
      out.setSeedSlug = argv[++i];
      out.setSeedValue = argv[++i];
    } else if (a === "--approve-list") out.approveList = true;
    else if (a === "--apply-seeds") out.applySeeds = true;
    else if (a === "--record-matrix") {
      out.recordMatrixSlug = argv[++i];
    } else if (a === "--matrix-path") out.matrixPath = argv[++i];
    else if (a === "--matrix-status") out.matrixStatus = argv[++i];
    else if (a === "--setup-complete") out.setupComplete = true;
    else if (a === "--next-matrix") out.nextMatrix = true;
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--template") out.template = argv[++i];
    else if (a.startsWith("--")) {
      out.unknown = a;
    }
  }
  return out;
}
