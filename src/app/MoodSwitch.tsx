import { MOODS } from '../scene/sun';
import { useStore } from './store';

/** ☀️ Afternoon / 🌇 Golden hour / 🌙 Night: the light of the whole house. */
export function MoodSwitch({ className = '', labels }: { className?: string; labels: boolean }) {
  const mood = useStore((s) => s.mood);
  const setMood = useStore((s) => s.setMood);
  return (
    <div className={`seg ${className}`}>
      {MOODS.map((m) => (
        <button key={m.id} className={m.id === mood ? 'on' : ''} onClick={() => setMood(m.id)} title={m.name} aria-label={m.name}>
          {m.icon}{labels && ` ${m.name}`}
        </button>
      ))}
    </div>
  );
}
