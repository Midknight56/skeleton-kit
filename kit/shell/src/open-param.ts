// Reads `?open=settings` from the page address. The privacy page links back to the Settings screen with it.
export function parseOpenParam(search: string): 'settings' | null {
  return new URLSearchParams(search).get('open') === 'settings' ? 'settings' : null;
}
