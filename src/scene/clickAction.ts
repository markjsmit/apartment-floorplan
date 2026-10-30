// What a click/tap on something in the scene does. Phones: a tap opens/closes (bed, doors), nothing else —
// unless Select is switched on in the ☰ menu, then a tap selects like on desktop. Desktop: click selects,
// double-click changes state.

export type ClickAction = 'select' | 'cycle' | 'none';

export function clickAction({ phone, interactive, tapSelects = false }: { phone: boolean; interactive: boolean; tapSelects?: boolean }): ClickAction {
  if (!phone || tapSelects) return 'select';
  return interactive ? 'cycle' : 'none';
}

export const PHONE_QUERY = '(pointer: coarse) and (max-width: 900px)';

export function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches;
}
