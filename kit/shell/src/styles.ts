import type { Theme } from './theme';

// The page style of a game, built from its theme. System fonts only, no url() and no import.
// `--u` is the size of one px of the menu screens. It is 1px up to 360 px wide (or 640 px high) and
// grows to 2px at 1920 by 1080, whichever of width and height gives the smaller value. The play and
// watch screens place their controls in px from the layout, so there `--u` stays 1px.
export function themeCss(theme: Theme): string {
  const p = theme.palette;
  const t = theme.typeScale;
  const u = (n: number) => `calc(${n} * var(--u))`;
  // The art of the theme, if any, goes over the card colour.
  const art = theme.cardArt ? `${theme.cardArt}, ` : '';
  return `
:root { color-scheme: dark; --u: clamp(1px, min(calc(1px + (100vw - 360px) / 1560), calc(1px + (100vh - 640px) / 440)), 2px); }
html, body { margin: 0; height: 100%; background: ${p.background}; color: ${p.text}; font: ${t.body}px system-ui, -apple-system, "Segoe UI", sans-serif; }
[data-screen] { position: relative; box-sizing: border-box; min-height: 100vh; min-height: 100dvh; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${u(12)}; background: ${p.background}; font-size: ${u(t.body)}; }
[data-kit-root] { box-sizing: border-box; min-height: 100vh; min-height: 100dvh; display: flex; align-items: safe center; justify-content: safe center; }
[data-card] { box-sizing: border-box; position: relative; margin: 16px; width: fit-content; min-height: 0; max-width: calc(100vw - 32px); padding: ${u(56)} ${u(16)} ${u(24)}; gap: ${u(12)}; border: 2px solid color-mix(in srgb, ${p.primary} 45%, transparent); border-radius: ${theme.buttonRadius + 8}px; background: ${art}color-mix(in srgb, ${p.surface} 70%, ${p.background}); }
[data-column] { display: grid; gap: ${u(12)}; justify-items: stretch; width: max-content; max-width: 100%; }
[data-screen="play"], [data-screen="watch"] { --u: 1px; }
[data-screen="play"] { display: block; padding: 0; overflow: hidden; }
h1, h2 { margin: 0; font-size: ${u(t.title)}; color: ${p.primary}; text-align: center; }
p, li { font-size: ${u(t.body)}; }
[data-screen] p { margin: 0; text-align: center; }
ul { margin: 0; padding-left: ${u(24)}; }
small, .muted { font-size: ${u(t.small)}; color: ${p.muted}; }
button, a[data-control] { box-sizing: border-box; min-width: ${u(44)}; min-height: ${u(44)}; padding: ${u(8)} ${u(16)}; border: 2px solid ${p.primary}; border-radius: ${theme.buttonRadius}px; background: ${p.surface}; color: ${p.text}; font: inherit; text-decoration: none; cursor: pointer; }
a[data-control] { display: inline-flex; align-items: center; justify-content: center; }
button[aria-pressed="true"], button.primary { background: ${p.primary}; color: ${p.background}; }
button[aria-disabled="true"] { opacity: 0.5; cursor: default; }
button:disabled, button:disabled:hover { opacity: 0.4; border-style: dashed; cursor: default; }
button:focus-visible, a[data-control]:focus-visible { outline: 3px solid ${p.accent}; outline-offset: 2px; }
[data-dialog="confirm"] { position: fixed; inset: 0; z-index: 1; display: flex; align-items: safe center; justify-content: safe center; overflow: auto; background: ${p.background}; }
[data-dialog="confirm"] [data-card] { display: flex; flex-direction: column; align-items: center; }
[data-notice] { color: ${p.accent}; font-size: ${u(t.small)}; }
[data-reason] { color: ${p.danger}; font-size: ${u(t.body)}; }
[data-hint] { position: absolute; padding: 4px 8px; border-radius: ${theme.buttonRadius}px; background: ${p.accent}; color: ${p.background}; font-size: ${t.small}px; pointer-events: none; }
canvas { display: block; touch-action: none; }
.tiles { display: flex; flex-wrap: wrap; gap: ${u(12)}; justify-content: center; max-width: ${u(480)}; }
.tiles button { width: ${u(88)}; }
`;
}
