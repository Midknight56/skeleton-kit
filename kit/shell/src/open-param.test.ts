// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseOpenParam } from './open-param';
import { PRIVACY_HREF, privacyHref, settingsScreen } from './screens/settings';

describe('the privacy link of the settings screen', () => {
  const props = { settings: { sound: true, music: true, usage: true }, onToggle() {}, onReset() {}, onBack() {} };

  it('says which game it comes from, so the privacy page can come back', () => {
    expect(privacyHref('garden')).toBe('../privacy/?from=garden');
    const link = settingsScreen(document, { ...props, gameId: 'garden' }).querySelector<HTMLAnchorElement>('[data-control="privacy"]')!;
    expect(link.getAttribute('href')).toBe('../privacy/?from=garden');
  });

  it('keeps the plain link when the game has no id', () => {
    expect(privacyHref()).toBe(PRIVACY_HREF);
    expect(settingsScreen(document, props).querySelector('[data-control="privacy"]')?.getAttribute('href')).toBe('../privacy/');
  });
});

describe('the open parameter of the page address', () => {
  it('opens Settings for ?open=settings and nothing else', () => {
    expect(parseOpenParam('?open=settings')).toBe('settings');
    expect(parseOpenParam('?open=other')).toBeNull();
    expect(parseOpenParam('')).toBeNull();
    expect(parseOpenParam('?watch=g01')).toBeNull();
  });
});