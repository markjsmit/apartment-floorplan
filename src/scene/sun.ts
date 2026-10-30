import type { Vec3 } from '../model/schema';

const DEG = Math.PI / 180;

/** Light is about the vibe at a few moments of the day, not the exact time, date or city. */
export type Mood = 'day' | 'golden' | 'night';

export const MOODS: { id: Mood; icon: string; name: string }[] = [
  { id: 'day', icon: '☀️', name: 'Daylight' },
  { id: 'golden', icon: '🌇', name: 'Golden hour' },
  { id: 'night', icon: '🌙', name: 'Night' },
];

export function isMood(v: unknown): v is Mood {
  return MOODS.some((m) => m.id === v);
}

/** Where the sun stands for each mood: compass bearing (degrees clockwise from north) and height above the horizon. */
const SUN: Record<Mood, { bearing: number; altitude: number } | null> = {
  day: { bearing: 225, altitude: 45 },
  golden: { bearing: 270, altitude: 7 },
  night: null,
};

/** At night a faint moon comes in through the (mostly west-facing) windows: a very low base light (Mark). */
const MOON = { bearing: 240, altitude: 40 };

/** Unit vector (room-local) pointing towards the sun, or null at night. */
export function sunForMood(mood: Mood, northAngle: number): Vec3 | null {
  const s = SUN[mood];
  return s ? towards(s, northAngle) : null;
}

/** Unit vector (room-local) pointing towards the moon at night, else null. */
export function moonForMood(mood: Mood, northAngle: number): Vec3 | null {
  return mood === 'night' ? towards(MOON, northAngle) : null;
}

function towards(s: { bearing: number; altitude: number }, northAngle: number): Vec3 {
  const a = northAngle * DEG;
  const north = [Math.sin(a), -Math.cos(a)];
  const east = [Math.cos(a), Math.sin(a)];
  const b = s.bearing * DEG;
  const c = Math.cos(s.altitude * DEG);
  return [(north[0] * Math.cos(b) + east[0] * Math.sin(b)) * c, Math.sin(s.altitude * DEG), (north[1] * Math.cos(b) + east[1] * Math.sin(b)) * c];
}
