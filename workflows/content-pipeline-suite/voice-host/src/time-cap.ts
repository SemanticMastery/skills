export type TimeCap = {
  label: string;
  max_label: string;
  max_ms: number;
};

/** Soft target + hard hang-up from series cadence. Unknown cadence uses the biweekly band. */
export function timeCapForCadence(cadence?: { freq?: string; interval?: number } | null): TimeCap {
  if (cadence?.freq === "monthly") {
    return { label: "30 to 45 minutes", max_label: "45 minutes", max_ms: 2_700_000 };
  }
  if (cadence?.freq === "weekly" && Number(cadence.interval || 1) === 1) {
    return { label: "10 to 15 minutes", max_label: "15 minutes", max_ms: 900_000 };
  }
  return { label: "20 to 30 minutes", max_label: "30 minutes", max_ms: 1_800_000 };
}
