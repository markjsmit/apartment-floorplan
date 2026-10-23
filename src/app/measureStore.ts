import { create } from 'zustand';
import { measureBetween, type Measurement, type SurfacePoint } from '../model/measure';
import type { Selection } from '../model/lookup';

// Kept apart from the main store: measuring is a tool mode, not part of the house view state.

export type MeasurePoint = SurfacePoint & { target: Selection | null };

type MeasureState = {
  active: boolean;
  points: MeasurePoint[];
  /** where the mouse points right now (live preview before clicking) */
  hover: MeasurePoint | null;
  /** "snap to outside" of furniture (Shift-click does it for one click) */
  snapOuter: boolean;
  toggle: () => void;
  setHover: (p: MeasurePoint | null) => void;
  toggleSnap: () => void;
  stop: () => void;
  add: (p: MeasurePoint) => void;
  reset: () => void;
};

export const useMeasure = create<MeasureState>((set, get) => ({
  active: false,
  points: [],
  hover: null,
  snapOuter: false,
  toggle: () => set({ active: !get().active, points: [], hover: null }),
  setHover: (hover) => set({ hover }),
  toggleSnap: () => set({ snapOuter: !get().snapOuter }),
  stop: () => set({ active: false, points: [], hover: null }),
  // a third click starts a new measurement
  add: (p) => set({ points: get().points.length >= 2 ? [p] : [...get().points, p] }),
  reset: () => set({ points: [] }),
}));

export function currentMeasurement(points: MeasurePoint[]): Measurement | null {
  return points.length === 2 ? measureBetween(points[0], points[1]) : null;
}

export function formatCm(cm: number): string {
  return cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${Math.round(cm)} cm`;
}
