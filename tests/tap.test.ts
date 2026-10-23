import { describe, expect, it } from 'vitest';
import { clickAction } from '../src/scene/clickAction';

describe('clickAction', () => {
  it('on a phone a tap on a moving part changes its state', () => {
    expect(clickAction({ phone: true, interactive: true })).toBe('cycle');
  });
  it('on a phone a tap on anything else does nothing (no info panel)', () => {
    expect(clickAction({ phone: true, interactive: false })).toBe('none');
  });
  it('on desktop a click selects (double-click changes state)', () => {
    expect(clickAction({ phone: false, interactive: true })).toBe('select');
    expect(clickAction({ phone: false, interactive: false })).toBe('select');
  });
});
