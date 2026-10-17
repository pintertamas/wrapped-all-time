import type { TimeRange } from "../data/sampleProfile";

export const RANGES: { range: TimeRange; label: string }[] = [
  { range: "short_term", label: "4 weeks" },
  { range: "medium_term", label: "6 months" },
  { range: "long_term", label: "12 months" },
];

export default function RangeTabs({ value, onChange }: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  return (
    <div className="tabs" role="tablist" aria-label="Time range">
      {RANGES.map(({ range, label }) => (
        <button
          key={range}
          type="button"
          role="tab"
          aria-selected={value === range}
          className={value === range ? "tab tab-active" : "tab"}
          onClick={() => onChange(range)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
