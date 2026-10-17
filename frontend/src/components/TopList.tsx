export interface TopItem {
  key: string;
  primary: string;
  secondary?: string;
}

export default function TopList({ title, items }: { title: string; items: TopItem[] }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <ol className="toplist">
        {items.map((it) => (
          <li key={it.key}>
            <span className="primary">{it.primary}</span>
            {it.secondary && <span className="note secondary">{it.secondary}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
