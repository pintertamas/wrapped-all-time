// GoatCounter adapter. Lazy-loaded by track.ts only when the provider is "goatcounter".
// It receives an already-built enum path (see eventPath in track.ts) and nothing else.
import { config } from "../config";

interface GoatCounterGlobal {
  count?: (vars: { path: string; event: boolean }) => void;
}

let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = `${config.basePath}goatcounter-count.js`;
    s.setAttribute("data-goatcounter", `https://${config.analyticsSite.toLowerCase()}.goatcounter.com/count`);
    s.setAttribute("data-goatcounter-settings", JSON.stringify({ no_onload: true }));
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("analytics script failed"));
    document.head.appendChild(s);
  });
  return loading;
}

export async function send(path: string): Promise<void> {
  await load();
  const gc = (window as unknown as { goatcounter?: GoatCounterGlobal }).goatcounter;
  gc?.count?.({ path, event: true });
}
