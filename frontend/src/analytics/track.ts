// Analytics wrapper. A no-op (no request, no script) unless VITE_ANALYTICS_PROVIDER enables it.
// Props are bucketed enums only; free text (artist, track, file name, key) cannot be expressed.
import { config } from "../config";
import type { ImportErrorCode } from "../model/types";

export type EventName =
  | "guide_viewed" | "export_guide_step_clicked" | "reminder_downloaded" | "file_dropped"
  | "file_type_detected" | "parse_failed" | "recap_viewed" | "year_switched" | "share_card_exported"
  | "unlock_teaser_clicked" | "checkout_opened" | "unlock_code_entered" | "unlock_success" | "login_clicked";

export type EventProps = {
  kind?: "standard" | "extended" | "unrecognised";
  errorClass?: ImportErrorCode;
  tier?: "free" | "paid";
  count?: 1 | 2 | 3 | 5 | 10;
};

const SAFE = /^[a-z0-9_-]+$/;

/** Path sent to the provider: event/<name>[/<enum>]. Values failing the enum shape are dropped. */
export function eventPath(name: EventName, props?: EventProps): string {
  const parts = ["event", name];
  const v = props && (props.kind ?? props.errorClass ?? props.tier ?? props.count);
  if (v !== undefined) {
    const s = String(v);
    if (SAFE.test(s)) parts.push(s);
  }
  return parts.join("/");
}

export function track(name: EventName, props?: EventProps): void {
  if (config.analyticsProvider !== "goatcounter" || !config.analyticsSite) return;
  const path = eventPath(name, props);
  void import("./goatcounter").then((m) => m.send(path)).catch(() => undefined);
}
