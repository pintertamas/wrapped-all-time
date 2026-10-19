/** The only way the app reaches the renderer: a dynamic import, so it stays a lazy chunk. */
export const loadShareRenderer = () => import("./render");
