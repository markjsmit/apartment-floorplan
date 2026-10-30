import type { Vec3 } from '../model/schema';

const DEG = Math.PI / 180;

/** Light is about the vibe at a few moments of the day, not the exact time, date or city. */
export type Mood = 'afternoon' | 'golden' | 'night';

export const MOODS: { id: Mood; icon: string; name: string }[] = [
  { id: 'afternoon', icon: '☀️', name: 'Afternoon' },
  { id: 'golden', icon: '🌇', name: 'Golden hour' },
  { id: 'night', icon: '🌙', name: 'Night' },
];

export function isMood(v: unknown): v is Mood {
  return MOODS.some((m) => m.id === v);
}

/** Where the sun stands for each mood: compass bearing (degrees clockwise from north) and height above the horizon. */
const SUN: Record<Mood, { bearing: number; altitude: number } | null> = {
  afternoon: { bearing: 225, altitude: 45 },
  golden: { bearing: 270, altitude: 7 },
  night: null,
};

/** Unit vector (room-local) pointing towards the sun, or null at night. */
export function sunForMood(mood: Mood, northAngle: number): Vec3 | null {
  const s = SUN[mood];
  if (!s) return null;
  const a = northAngle * DEG;
  const north = [Math.sin(a), -Math.cos(a)];
  const east = [Math.cos(a), Math.sin(a)];
  const b = s.bearing * DEG;
  const c = Math.cos(s.altitude * DEG);
  return [(north[0] * Math.cos(b) + east[0] * Math.sin(b)) * c, Math.sin(s.altitude * DEG), (north[1] * Math.cos(b) + east[1] * Math.sin(b)) * c];
}
