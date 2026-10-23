import { describe, expect, it } from 'vitest';
import { createReporter } from '../src/app/uiState';

describe('createReporter', () => {
  it('sends only when the state actually changed', () => {
    const sent: unknown[] = [];
    const report = createReporter((s) => sent.push(s));
    report({ room: 'a', version: 'current' }, true);
    report({ room: 'a', version: 'current' }, true); // e.g. a data reload that changed nothing
    report({ room: 'b', version: 'current' }, true);
    expect(sent).toEqual([{ room: 'a', version: 'current' }, { room: 'b', version: 'current' }]);
  });

  it('stays quiet in a tab that is not the active one', () => {
    const sent: unknown[] = [];
    const report = createReporter((s) => sent.push(s));
    report({ room: 'a', version: 'suggestion' }, false);
    expect(sent).toEqual([]);
  });

  it('re-sends its state when the tab becomes active again', () => {
    const sent: unknown[] = [];
    const report = createReporter((s) => sent.push(s));
    report({ room: 'a', version: 'current' }, true);
    report({ room: 'a', version: 'current' }, false);
    report.activate();
    expect(sent).toEqual([{ room: 'a', version: 'current' }, { room: 'a', version: 'current' }]);
  });
});
