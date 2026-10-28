import { create } from 'zustand';
import { measureBetween, type MeasureMode, type Measurement, type SurfacePoint } from '../model/measure';
import type { Selection } from '../model/lookup';

// Kept apart from the main store: measuring is a tool mode, not part of the house view state.

export type MeasurePoint = SurfacePoint & {
  target: Selection | null;
  /** the same spot on the other side of the clicked board (double-click / "Other side" swaps to it) */
  other?: SurfacePoint;
  flipped?: boolean;
};

type MeasureState = {
  active: boolean;
  mode: MeasureMode;
  points: MeasurePoint[];
  toggle: () => void;
  stop: () => void;
  add: (p: MeasurePoint) => void;
  /** move the last clicked point to the other side of its board */
  flipLast: () => void;
  reset: () => void;
  setMode: (mode: MeasureMode) => void;
};

export const useMeasure = create<MeasureState>((set, get) => ({
  active: false,
  mode: 'axis',
  points: [],
  toggle: () => set({ active: !get().active, points: [] }),
  stop: () => set({ active: false, points: [] }),
  // a third click starts a new measurement
  add: (p) => set({ points: get().points.length >= 2 ? [p] : [...get().points, p] }),
  flipLast: () => {
    const points = [...get().points];
    const last = points[points.length - 1];
    if (!last?.other) return;
    const { point, normal } = last;
    points[points.length - 1] = { ...last, ...last.other, other: { point, normal }, flipped: !last.flipped };
    set({ points });
  },
  reset: () => set({ points: [] }),
  setMode: (mode) => set({ mode }),
}));

export function currentMeasurement(points: MeasurePoint[], mode: MeasureMode = useMeasure.getState().mode): Measurement | null {
  return points.length === 2 ? measureBetween(points[0], points[1], mode) : null;
}

export function formatCm(cm: number): string {
  return cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${Math.round(cm)} cm`;
}

// dev-only handle so Claude's browser checks can read the clicked points
if (import.meta.env.DEV) (globalThis as { __measure?: typeof useMeasure }).__measure = useMeasure;
