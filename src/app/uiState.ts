// Deciding when this tab tells Claude what Mark sees. With several tabs open, only the one Mark used
// last reports, and only when something changed — so a live reload in a background tab can't
// overwrite .ui-state/ui-state.json with the wrong version.

export type Reporter = ((state: unknown, active: boolean) => void) & { activate: () => void };

export function createReporter(send: (state: unknown) => void): Reporter {
  let lastSent: string | null = null;
  let latest: unknown = null;
  const report = ((state: unknown, active: boolean) => {
    latest = state;
    const key = JSON.stringify(state);
    if (!active || key === lastSent) return;
    lastSent = key;
    send(state);
  }) as Reporter;
  report.activate = () => {
    if (latest === null) return;
    lastSent = JSON.stringify(latest);
    send(latest);
  };
  return report;
}

const TAB_KEY = 'apartment.activeTab';
export const tabId = Math.random().toString(36).slice(2);

/** Mark this tab as the one Mark is using (on focus / click). */
export function claimActiveTab() {
  try {
    localStorage.setItem(TAB_KEY, tabId);
  } catch {
    /* storage blocked: every tab counts as active */
  }
}

export function isActiveTab(): boolean {
  try {
    const owner = localStorage.getItem(TAB_KEY);
    return owner === null || owner === tabId;
  } catch {
    return true;
  }
}
