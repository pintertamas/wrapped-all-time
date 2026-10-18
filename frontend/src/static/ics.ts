// Reminder .ics (eng/frontend.md § Generated output files). Built in the browser, nothing is sent.
export const RECAP_WEEK = "2026-12-02";
export const ICS_FILE_NAME = "wrapped-all-time-reminder.ics";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Fold a content line at 75 octets (RFC 5545 3.1): CRLF + space, never inside a UTF-8 char. */
export function foldLine(line: string): string {
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end < bytes.length && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--;
    parts.push(dec.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74; // continuation lines start with a space
  }
  return parts.join("\r\n ");
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** YYYYMMDD of a date's local calendar day. */
export function formatDate(d: Date): string {
  return `${pad(d.getFullYear(), 4)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** YYYY-MM-DD (the value of an <input type="date">) of a date's local calendar day. */
export function toInputValue(d: Date): string {
  const s = formatDate(d);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`;
}

/** Request day + 30, the default reminder day. */
export function defaultReminderDate(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
}

export function randomUid(host: string): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return `${Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("")}@${host}`;
}

export interface IcsOptions {
  /** Day of the reminder (all-day). Defaults to today + 30. */
  start?: Date;
  today?: Date;
  host: string;
  guideUrl: string;
  includeRecapWeek?: boolean;
  /** Test hook. */
  uid?: (host: string) => string;
  now?: Date;
}

export function buildIcs(o: IcsOptions): string {
  const today = o.today ?? new Date();
  const start = o.start ?? defaultReminderDate(today);
  const uid = o.uid ?? randomUid;
  const now = o.now ?? new Date();
  const stamp = `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const event = (summary: string, date: string, description: string, alarm: boolean): string[] => [
    "BEGIN:VEVENT",
    `UID:${uid(o.host)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${date}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(alarm
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(summary)}`, "TRIGGER:PT9H", "END:VALARM"]
      : []),
    "END:VEVENT",
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${o.host}//reminder//EN`,
    "CALSCALE:GREGORIAN",
    ...event("Your Spotify data export should be ready", formatDate(start), o.guideUrl, true),
    ...(o.includeRecapWeek
      ? event("Recap week: load your file", RECAP_WEEK.replace(/-/g, ""), o.guideUrl, false)
      : []),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
