import { useStore } from './store';

export function Banner() {
  const errors = useStore((s) => s.bundle?.errors ?? []);
  const loadError = useStore((s) => s.loadError);
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="banners">
      {loadError && <div className="banner error">{loadError}</div>}
      {errors.length > 0 && (
        <div className="banner error">
          <strong>House data problem — showing the last good version:</strong>
          <ul>{errors.map((e) => <li key={e.file + e.message}>{e.file}: {e.message}</li>)}</ul>
        </div>
      )}
      {toasts.map((t) => <div key={t.id} className="banner toast">💬 {t.text}</div>)}
    </div>
  );
}
