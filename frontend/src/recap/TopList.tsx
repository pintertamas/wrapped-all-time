export interface TopItem {
  key: string;
  primary: string;
  secondary?: string;
  /** Minutes; drives the bar. The same numbers are always printed as text. */
  minutes?: number;
  plays?: number;
}

/** Ranked list. The bar is decoration (aria-hidden); every row prints its numbers as text. */
export default function TopList({ title, items }: { title: string; items: TopItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.minutes ?? 0));
  return (
    <section className="card" aria-label={title}>
      <h2>{title}</h2>
      <ol className="toplist">
        {items.map((it) => (
          <li key={it.key}>
            <span className="primary">{it.primary}</span>
            {it.secondary && <span className="note secondary">{it.secondary}</span>}
            {it.minutes !== undefined && (
              <>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${Math.round((it.minutes / max) * 100)}%` }} />
                </span>
                <span className="note secondary">
                  {it.minutes.toLocaleString("en-US")} min
                  {it.plays !== undefined ? `, ${it.plays.toLocaleString("en-US")} plays` : ""}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
