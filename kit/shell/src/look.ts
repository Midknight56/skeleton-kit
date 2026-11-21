import { FONT_CODE, FONT_TEXT } from './fonts';
import { STRING_COLOUR, TOKENS as T } from './tokens';
import type { Theme } from './theme';

// A size that is `phone` px at 360 px wide (or 640 px high) and `desk` px at 1920 by 1080. It follows
// `--u`, the size of one px of the menu screens, which goes from 1px to 2px.
const L = (phone: number, desk: number): string => `calc(${phone}px + ${desk - phone} * (var(--u) - 1px))`;

const GLOW = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

// The look shared by every game: the sky, the rail, the strings, the signs, the cards and the garland.
// It comes after the base rules of `themeCss`, so each rule here may refine one of those. Colours come
// from the tokens. Every picture of it ignores the pointer.
export function lookCss(theme: Theme): string {
  const glow = theme.glow !== undefined && GLOW.test(theme.glow) ? theme.glow : '#2d2357';
  const p = theme.palette;
  return `
[data-backdrop] { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; background: radial-gradient(ellipse 1000px 800px at 72% 36%, ${glow} 0, transparent 64%), linear-gradient(${T.night} 0, #191231 62%, ${T.dusk} 100%); }
[data-backdrop] [data-stars] { position: absolute; inset: 0; }
[data-backdrop] [data-stars] svg { display: block; width: 100%; height: 100%; }
[data-moon] { position: absolute; top: ${L(60, 70)}; right: ${L(20, 80)}; width: ${L(84, 150)}; aspect-ratio: 1; border-radius: 50%; background: ${T.bone}; box-shadow: 0 0 0 ${L(6, 12)} rgb(239 231 210 / .05), 0 0 80px 10px rgb(239 231 210 / .14); }
[data-moon] [data-crater] { position: absolute; border-radius: 50%; background: #ded4b9; }
[data-moon] [data-crater="a"] { left: 18%; top: 22%; width: 20%; height: 20%; }
[data-moon] [data-crater="b"] { left: 56%; top: 52%; width: 28%; height: 28%; }
[data-moon] [data-crater="c"] { left: 30%; top: 66%; width: 11%; height: 11%; }
[data-backdrop][data-look="title"] [data-moon], [data-backdrop][data-look="play"] [data-moon] { display: none; }
[data-backdrop] [data-puppet][data-culled] { display: none; }
[data-backdrop] [data-art] { position: absolute; inset: 0; display: none; }
[data-backdrop] [data-art] svg { display: block; width: 100%; height: 100%; }
@media (min-aspect-ratio: 5/4) { [data-backdrop][data-look="title"] [data-art="wide"] { display: block; } }
@media (max-aspect-ratio: 5/4) { [data-backdrop][data-look="title"] [data-art="narrow"] { display: block; } }
@media (min-width: 481px) { [data-backdrop] [data-art="narrow"] svg { width: 480px; height: 853px; margin-left: auto; } }
[data-rail] { position: fixed; top: 0; left: 0; right: 0; z-index: 5; box-sizing: border-box; height: ${L(10, 16)}; background: ${T.plum}; border-bottom: 3px solid ${T.ink}; pointer-events: none; }

[data-screen] { background: transparent; z-index: 1; font-family: ${FONT_TEXT}; }
[data-kit-root] { position: relative; z-index: 1; }
h1, h2 { color: ${p.text}; font-weight: 800; letter-spacing: -0.03em; }
[data-card] { border: 1.5px solid ${T.plum}; border-radius: ${L(12, 16)}; box-shadow: 0 ${L(4, 10)} 0 ${T.ink}; }
[data-card]:not([data-screen="title"])::before, [data-card]:not([data-screen="title"])::after { content: ""; position: absolute; bottom: 100%; width: 1.5px; height: 100vh; background: ${STRING_COLOUR}; pointer-events: none; }
[data-card]:not([data-screen="title"])::before { left: 22%; }
[data-card]:not([data-screen="title"])::after { right: 22%; }

button, a[data-control] { border: 0; border-radius: ${L(11, 14)}; background: ${T.plum}; color: ${T.bone}; font-family: ${FONT_TEXT}; font-weight: 700; box-shadow: 0 4px 0 ${T.ink}; transition: transform 80ms ease-out, box-shadow 80ms ease-out; }
button:active:not(:disabled), a[data-control]:active { transform: translateY(3px); box-shadow: 0 1px 0 ${T.ink}; transition-duration: 80ms; }
button[aria-pressed="true"], button.primary { background: ${T.warm}; color: ${T.night}; box-shadow: 0 5px 0 ${T.warmDeep}; }
button[aria-pressed="true"]:active { box-shadow: 0 2px 0 ${T.warmDeep}; }
[data-control="watch"] { border: 2px solid ${T.program}; background: ${T.programFill}; color: ${T.program}; }
button:disabled, button:disabled:hover { box-shadow: 0 4px 0 ${T.ink}; }
button:focus-visible, a[data-control]:focus-visible { outline: 3px solid ${p.accent}; outline-offset: 3px; }
.tiles button { font-weight: 700; }
.tiles button[data-locked="true"] { background: ${T.dusk}; color: ${T.muted}; }
[data-dialog="confirm"] { background: rgb(12 9 25 / 0.92); }
[data-hint] { font-weight: 700; box-shadow: 0 3px 0 ${T.ink}; }
[data-strip] { background: rgb(12 9 25 / 0.6); border-top: 1.5px solid ${T.plum}; box-sizing: border-box; }
[data-proof="line"] { font-family: ${FONT_CODE}; font-weight: 500; letter-spacing: 0.04em; color: ${T.program}; }
[data-notice] { font-family: ${FONT_CODE}; }
@media (prefers-reduced-motion: reduce) { button, a[data-control] { transition: none; } }

[data-screen="title"][data-card] { box-sizing: border-box; width: 100%; max-width: none; min-height: 100vh; min-height: 100dvh; margin: 0; padding: ${L(28, 88)} ${L(16, 96)} ${L(16, 40)}; gap: ${L(12, 20)}; align-items: flex-start; justify-content: flex-start; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
[data-screen="title"] h1 { margin: 0; font-size: clamp(44px, min(7.1vw, 12.6vh), 136px); line-height: 0.9; text-align: left; overflow-wrap: anywhere; }
[data-screen="title"] p { text-align: left; color: ${T.muted}; max-width: min(640px, 100%); line-height: 1.4; font-size: ${L(14, 24)}; }
[data-screen="title"] p[data-notice] { color: ${p.accent}; font-size: ${L(13, 16)}; }
[data-screen="title"] [data-column] { position: relative; box-sizing: border-box; width: min(100%, 440px); margin-top: ${L(14, 40)}; padding-top: ${L(18, 38)}; gap: ${L(12, 16)}; background: linear-gradient(${STRING_COLOUR}, ${STRING_COLOUR}) 28px 0 / 1.5px 100% no-repeat, linear-gradient(${STRING_COLOUR}, ${STRING_COLOUR}) calc(100% - 28px) 0 / 1.5px 100% no-repeat; }
[data-screen="title"] [data-column]::before { content: ""; position: absolute; top: 0; left: 8px; right: 8px; height: ${L(5, 8)}; border-radius: 4px; background: ${T.bone}; box-shadow: 0 3px 0 ${T.ink}; pointer-events: none; }
[data-screen="title"] [data-control] { min-height: ${L(46, 64)}; font-size: ${L(16, 22)}; padding: 0 ${L(16, 24)}; }
[data-screen="title"] [data-control="play"] { min-height: ${L(52, 78)}; font-size: ${L(18, 32)}; background: ${T.warm}; color: ${T.night}; box-shadow: 0 6px 0 ${T.warmDeep}; border-radius: ${L(11, 14)}; }
[data-screen="title"] [data-control="play"]:active { box-shadow: 0 2px 0 ${T.warmDeep}; }
[data-screen="title"] [data-control="watch"] { box-shadow: 0 4px 0 ${T.ink}; }
@media (max-width: 480px) { [data-screen="title"] [data-column] { grid-template-columns: 1fr 1fr; } }

[data-garland] { position: absolute; left: 0; right: 0; bottom: 0; box-sizing: border-box; height: ${L(110, 176)}; padding: 0 ${L(16, 96)}; background: #110d21; border-top: 1.5px solid ${T.plum}; pointer-events: none; display: none; }
[data-garland] .wire { position: absolute; left: ${L(16, 96)}; right: ${L(16, 96)}; top: ${L(26, 32)}; height: 1.5px; background: ${STRING_COLOUR}; }
[data-garland] .row { position: absolute; left: ${L(16, 96)}; right: ${L(16, 96)}; top: ${L(18, 24)}; display: flex; justify-content: space-between; }
[data-garland] [data-garland-item] { position: relative; display: flex; flex-direction: column; align-items: center; width: ${L(34, 68)}; }
[data-garland] .picture { display: block; width: ${L(22, 34)}; height: ${L(32, 50)}; }
[data-garland] .picture svg { display: block; width: 100%; height: 100%; }
[data-garland] [data-ring="true"] .picture { outline: 1.5px dashed ${T.bone}; outline-offset: 5px; border-radius: 50%; }
[data-garland] .number { margin-top: 6px; font-family: ${FONT_CODE}; font-size: ${L(12, 13)}; color: ${T.muted}; }
[data-garland] .note { position: absolute; right: ${L(16, 96)}; bottom: ${L(8, 14)}; font-family: ${FONT_CODE}; font-size: ${L(13, 15)}; color: ${T.muted}; }
@media (min-width: 700px) and (min-height: 640px) {
  [data-garland] { display: block; }
  [data-screen="title"][data-garland-below] { padding-bottom: calc(${L(110, 176)} + 16px); }
}

@media (prefers-reduced-motion: no-preference) {
  [data-sway] { transform-box: fill-box; transform-origin: 50% 0; animation: kit-sway 5s ease-in-out infinite alternate; }
  @keyframes kit-sway { from { transform: rotate(-1.5deg); } to { transform: rotate(1.5deg); } }
}
`;
}
