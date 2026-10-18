import { describe, expect, it } from "vitest";
import { buildIcs, defaultReminderDate, foldLine } from "./ics";
import { whichFile } from "./whichFile";
import { countdownText } from "./countdown";

const opts = { host: "example.com", guideUrl: "https://example.com/guide/", today: new Date(2026, 9, 18), now: new Date(Date.UTC(2026, 9, 18, 8, 0, 0)) };

describe("ics", () => {
  const ics = buildIcs({ ...opts, uid: (h) => `abc@${h}` });
  it("uses CRLF only and ends with CRLF", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });
  it("sets DTSTART to today + 30, alarm PT9H, no recap by default", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261117\r\n");
    expect(ics).toContain("TRIGGER:PT9H\r\n");
    expect(ics).toContain("UID:abc@example.com\r\n");
    expect(ics).not.toContain("20261202");
    expect(defaultReminderDate(new Date(2026, 0, 31)).getMonth()).toBe(2);
  });
  it("honours an edited date and the optional recap event", () => {
    const out = buildIcs({ ...opts, start: new Date(2026, 10, 1), includeRecapWeek: true });
    expect(out).toContain("DTSTART;VALUE=DATE:20261101");
    expect(out).toContain("DTSTART;VALUE=DATE:20261202");
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
  it("generates random UIDs at the host", () => {
    const uid = (s: string) => /UID:(.*)\r\n/.exec(s)![1]!;
    const a = uid(buildIcs(opts));
    expect(a).toMatch(/^[0-9a-f]{32}@example\.com$/);
    expect(a).not.toBe(uid(buildIcs(opts)));
  });
  it("folds at 75 octets without splitting characters", () => {
    const long = "DESCRIPTION:" + "é".repeat(100);
    const folded = foldLine(long);
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
    for (const l of buildIcs({ ...opts, guideUrl: "https://example.com/" + "a".repeat(200) }).split("\r\n"))
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});

describe("whichFile", () => {
  it.each([
    ["my_spotify_data.zip", "account"],
    ["my_spotify_data (1).zip", "account"],
    ["my_spotify_extended_streaming_history.zip", "extended"],
    ["Streaming_History_Audio_2019-2021_3.json", "extended"],
    ["StreamingHistory_music_0.json", "account"],
    ["Playlist1.json", "other"],
    ["holiday.png", "unknown"],
  ])("%s -> %s", (name, kind) => expect(whichFile(name).kind).toBe(kind));
});

describe("countdown", () => {
  it("counts days and hides on and after the date", () => {
    expect(countdownText(new Date(2026, 10, 30))).toBe("2 days until recap week (2 Dec 2026)");
    expect(countdownText(new Date(2026, 11, 1))).toBe("1 day until recap week (2 Dec 2026)");
    expect(countdownText(new Date(2026, 11, 2))).toBeNull();
    expect(countdownText(new Date(2027, 0, 5))).toBeNull();
  });
});
