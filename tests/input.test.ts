import { describe, expect, it } from 'vitest';
import { moveKeyFor, ignoresKeys } from '../src/scene/input';

describe('moveKeyFor', () => {
  it('uses the physical key, so WASD works on a Hebrew keyboard layout too', () => {
    expect(moveKeyFor({ code: 'KeyW', key: "'" })).toBe('forward');
    expect(moveKeyFor({ code: 'KeyA', key: 'ש' })).toBe('strafeLeft');
    expect(moveKeyFor({ code: 'KeyS', key: 'ד' })).toBe('back');
    expect(moveKeyFor({ code: 'KeyD', key: 'ג' })).toBe('strafeRight');
    expect(moveKeyFor({ code: 'KeyE', key: 'ק' })).toBe('up');
    expect(moveKeyFor({ code: 'KeyC', key: 'ב' })).toBe('down');
  });

  it('keeps the arrows', () => {
    expect(moveKeyFor({ code: 'ArrowUp', key: 'ArrowUp' })).toBe('forward');
    expect(moveKeyFor({ code: 'ArrowLeft', key: 'ArrowLeft' })).toBe('left');
  });

  it('ignores other keys', () => {
    expect(moveKeyFor({ code: 'KeyQ', key: 'q' })).toBeUndefined();
  });
});

describe('ignoresKeys', () => {
  it('lets text fields keep their keys but not sliders or buttons', () => {
    expect(ignoresKeys({ tagName: 'TEXTAREA' })).toBe(true);
    expect(ignoresKeys({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(ignoresKeys({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(ignoresKeys({ tagName: 'BUTTON' })).toBe(false);
  });
});
