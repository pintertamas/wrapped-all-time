// Progressive enhancement for the guide page; the page reads fine without this script.
import { buildIcs, defaultReminderDate, ICS_FILE_NAME, toInputValue } from "./ics";
import { whichFile } from "./whichFile";
import { countdownText } from "./countdown";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

function initCountdown(): void {
  const el = $("countdown");
  if (!el) return;
  const text = countdownText(new Date());
  if (text === null) el.hidden = true;
  else {
    el.textContent = text;
    el.hidden = false;
  }
}

function initWhichFile(): void {
  const input = $<HTMLInputElement>("which-input");
  const out = $("which-result");
  if (!input || !out) return;
  const show = (name: string) => {
    out.textContent = name ? whichFile(name).message : "";
  };
  input.addEventListener("input", () => show(input.value));
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) show(f.name); // only the name is read, never the contents
  });
  const wrap = $("which");
  if (wrap) wrap.hidden = false;
}

function initReminder(): void {
  const form = $("reminder");
  const date = $<HTMLInputElement>("reminder-date");
  const recap = $<HTMLInputElement>("reminder-recap");
  if (!form || !date) return;
  date.value = toInputValue(defaultReminderDate(new Date()));
  form.hidden = false;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const [y, m, d] = date.value.split("-").map(Number);
    const start = y && m && d ? new Date(y, m - 1, d) : undefined;
    const ics = buildIcs({
      start,
      host: location.host,
      guideUrl: location.origin + location.pathname,
      includeRecapWeek: recap?.checked ?? false,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = ICS_FILE_NAME;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

initCountdown();
initWhichFile();
initReminder();
