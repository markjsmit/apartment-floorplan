import type { Bundle } from '../model/bundle';

// The only place the app talks to the dev server. In the static build (import.meta.env.DEV false)
// nothing here touches /api, so the public site never tries to reach Claude.

export type Command =
  | { type: 'select'; id: string }
  | { type: 'clear' }
  | { type: 'goto'; room: string; version?: string }
  | { type: 'look-at'; id: string }
  | { type: 'toast'; text: string }
  | { type: 'reload' };

export const DEV_LINK = import.meta.env.DEV;

export async function fetchBundle(): Promise<Bundle> {
  const url = DEV_LINK ? '/api/bundle' : `${import.meta.env.BASE_URL}bundle.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`could not load ${url}: ${res.status}`);
  return res.json();
}

export function libUrl(baseUrl: string, file: string): string {
  return `${import.meta.env.BASE_URL}${baseUrl}${file}`;
}

export function subscribe(onReload: () => void, onCommand: (c: Command) => void): () => void {
  if (!DEV_LINK) return () => {};
  const es = new EventSource('/api/events');
  es.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'reload') onReload();
    if (msg.type === 'command') onCommand(msg.command);
  };
  return () => es.close();
}

function post(url: string, body: unknown) {
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
}

let uiTimer: ReturnType<typeof setTimeout> | undefined;
export function reportUiState(state: unknown) {
  if (!DEV_LINK) return;
  clearTimeout(uiTimer);
  uiTimer = setTimeout(() => post('/api/ui-state', state), 300);
}

export function reportEvent(event: Record<string, unknown>) {
  if (!DEV_LINK) return;
  post('/api/event', event);
}
