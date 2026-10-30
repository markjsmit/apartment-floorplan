import { MOODS } from '../scene/sun';
import { LIGHT_MODES } from '../model/lights';
import { useStore } from './store';

type Option<T> = { id: T; icon: string; name: string };

function Seg<T extends string>({ options, value, onPick, className, labels }: {
  options: Option<T>[]; value: T; onPick: (v: T) => void; className: string; labels: boolean;
}) {
  return (
    <div className={`seg ${className}`}>
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onPick(o.id)} title={o.name} aria-label={o.name}>
          {o.icon}{labels && ` ${o.name}`}
        </button>
      ))}
    </div>
  );
}

/** ☀️ Afternoon / 🌇 Golden hour / 🌙 Night: the daylight of the whole house. */
export function MoodSwitch({ className = '', labels }: { className?: string; labels: boolean }) {
  const mood = useStore((s) => s.mood);
  const setMood = useStore((s) => s.setMood);
  return <Seg options={MOODS} value={mood} onPick={setMood} className={className} labels={labels} />;
}

/** ⚫ Off / 🕯️ Cozy / 💡 Work: every lamp in the house. */
export function LightModeSwitch({ className = '', labels }: { className?: string; labels: boolean }) {
  const mode = useStore((s) => s.lightMode);
  const setMode = useStore((s) => s.setLightMode);
  return <Seg options={LIGHT_MODES} value={mode} onPick={setMode} className={className} labels={labels} />;
}
