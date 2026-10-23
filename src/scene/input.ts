// Shared "held" movement inputs: keyboard and on-screen touch buttons both write here.
export type MoveKey = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down';
export const held = new Set<MoveKey>();

/** Look deltas (degrees) from trackpad / touch drags, consumed each frame by the controls. */
export const lookDelta = { yaw: 0, pitch: 0 };
