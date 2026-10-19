// Per-year static landing pages (/year/<yyyy>/), generated at build by vite.config.ts.
// Plain HTML, no JavaScript needed. Copy avoids Spotify's trademarked product naming.

export const FIRST_YEAR = 2012;

export function yearRange(now: Date = new Date()): number[] {
  const out: number[] = [];
  for (let y = now.getUTCFullYear(); y >= FIRST_YEAR; y--) out.push(y);
  return out;
}

export interface YearPageInput {
  year: number;
  productName: string;
  siteUrl: string; // ends with "/"
  robots: "index" | "noindex";
  csp: string;
  stylesheetTag: string; // a full <link rel="stylesheet"> tag, or ""
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderYearPage(i: YearPageInput): string {
  const name = esc(i.productName);
  const title = `Your ${i.year} Spotify listening history, from your data export · ${i.productName}`;
  const desc = `See your top artists, tracks and minutes listened for ${i.year} from your own Spotify data export. Everything is calculated in your browser.`;
  const url = `${i.siteUrl}year/${i.year}/`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${esc(i.csp)}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="${i.robots}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${i.siteUrl}og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#14111f" />
    <link rel="icon" href="data:," />
    ${i.stylesheetTag}
    <title>${esc(title)}</title>
  </head>
  <body>
    <main class="static-page">
      <p><a href="../../">Back to ${name}</a></p>
      <h1>Your ${i.year} listening history</h1>
      <p>Spotify only shows a recap of the last year. ${name} rebuilds ${i.year}, and every other year since you joined, from the data export Spotify gives you on request.</p>
      <h2>What you get for ${i.year}</h2>
      <ul>
        <li>Your top artists, tracks and albums.</li>
        <li>Total minutes listened, plays and active days.</li>
        <li>Your longest streak and your busiest day.</li>
        <li>Share cards sized for stories and posts.</li>
      </ul>
      <h2>How it works</h2>
      <ol>
        <li>Request your data in the <a href="../../guide/">export guide</a>.</li>
        <li>Load the files you receive. They are read on your device and never uploaded.</li>
        <li>Open ${i.year} in your recap.</li>
      </ol>
      <p><a href="../../#/import">Load my data</a>. Questions? Read the <a href="../../faq/">FAQ</a>.</p>
    </main>
    <footer class="static-footer">
      <p>${name} is not affiliated with, endorsed by or connected to Spotify.</p>
      <nav aria-label="Footer"><a href="../../guide/">Export guide</a> <a href="../../faq/">FAQ</a> <a href="../../privacy/">Privacy</a> <a href="../../terms/">Terms</a></nav>
    </footer>
  </body>
</html>
`;
}
