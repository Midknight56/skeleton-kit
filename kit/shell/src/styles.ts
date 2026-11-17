import type { Theme } from './theme';

// The page style of a game, built from its theme. System fonts only, no url() and no import.
export function themeCss(theme: Theme): string {
  const p = theme.palette;
  const t = theme.typeScale;
  return `
:root { color-scheme: dark; }
html, body { margin: 0; height: 100%; background: ${p.background}; color: ${p.text}; font: ${t.body}px system-ui, -apple-system, "Segoe UI", sans-serif; }
[data-screen] { position: relative; box-sizing: border-box; min-height: 100%; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: ${p.background}; }
[data-screen="play"] { display: block; padding: 0; overflow: hidden; }
h1, h2 { margin: 0; font-size: ${t.title}px; color: ${p.primary}; text-align: center; }
p, li { font-size: ${t.body}px; }
small, .muted { font-size: ${t.small}px; color: ${p.muted}; }
button { box-sizing: border-box; min-width: 44px; min-height: 44px; padding: 8px 16px; border: 2px solid ${p.primary}; border-radius: ${theme.buttonRadius}px; background: ${p.surface}; color: ${p.text}; font: inherit; cursor: pointer; }
button[aria-pressed="true"], button.primary { background: ${p.primary}; color: ${p.background}; }
button[aria-disabled="true"] { opacity: 0.5; cursor: default; }
button:focus-visible { outline: 3px solid ${p.accent}; outline-offset: 2px; }
[data-dialog="confirm"] { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: ${p.background}; padding: 16px; }
[data-notice] { color: ${p.accent}; font-size: ${t.small}px; }
[data-reason] { color: ${p.danger}; font-size: ${t.body}px; }
[data-hint] { position: absolute; padding: 4px 8px; border-radius: ${theme.buttonRadius}px; background: ${p.accent}; color: ${p.background}; font-size: ${t.small}px; pointer-events: none; }
canvas { display: block; touch-action: none; }
.tiles { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; max-width: 480px; }
`;
}
