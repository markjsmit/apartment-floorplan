// Shared "held" movement inputs: keyboard and on-screen touch buttons both write here.
export type MoveKey = 'forward' | 'back' | 'left' | 'right' | 'strafeLeft' | 'strafeRight' | 'up' | 'down';
export const held = new Set<MoveKey>();

/** Look deltas (degrees) from trackpad / touch drags, consumed each frame by the controls. */
export const lookDelta = { yaw: 0, pitch: 0 };

// By physical key (KeyboardEvent.code), so the controls work whatever keyboard layout is active (e.g. Hebrew).
const KEYS: Record<string, MoveKey> = {
  ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'forward', KeyS: 'back', KeyA: 'strafeLeft', KeyD: 'strafeRight', KeyE: 'up', KeyC: 'down',
};

export function moveKeyFor(e: { code: string; key: string }): MoveKey | undefined {
  return KEYS[e.code];
}

/** Text fields keep their keys; sliders and buttons don't steal walking. */
export function ignoresKeys(el: { tagName: string; type?: string } | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'button';
}

// degrees per pixel of finger movement
const TOUCH_SPEED = 0.25;

/** Look change for a touch drag: the view turns the way the finger moves (swipe right = turn right, up = look up). */
export function touchLook(dx: number, dy: number): { yaw: number; pitch: number } {
  return { yaw: -dx * TOUCH_SPEED, pitch: -dy * TOUCH_SPEED };
}
