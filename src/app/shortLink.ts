// Short links via is.gd (free, no account). JSONP, because is.gd doesn't send CORS headers for fetch();
// on any failure the caller gets null and copies the full link instead.

const TIMEOUT_MS = 8000;
let seq = 0;

export function shorten(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cb = `__isgd${++seq}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const done = (short: string | null) => {
      clearTimeout(timer);
      delete w[cb];
      script.remove();
      resolve(short);
    };
    const timer = setTimeout(() => done(null), TIMEOUT_MS);
    w[cb] = (r: { shorturl?: string }) => done(r?.shorturl ?? null);
    script.onerror = () => done(null);
    script.src = `https://is.gd/create.php?format=json&callback=${cb}&url=${encodeURIComponent(url)}`;
    document.head.appendChild(script);
  });
}
