import { STRING_COLOUR } from './tokens';

// The motion of the menu screens, in CSS. It is decoration: nothing here changes a size, a place in the
// layout or a rule of a game. The strings of a card sway and drop in, the old card leaves as a hollow
// ghost that rises, a button swings once when the pointer comes and bobs when it is pressed. The card
// and its controls stay where they are, so a test can click a control at once and measure it.
// With reduced motion every one of these is off, and a new screen only fades in over 150 ms.
export function motionCss(): string {
  return `
@media not all and (prefers-reduced-motion: reduce) {
  [data-screen]:not([data-screen="play"]):not([data-screen="watch"]):not([data-screen="loading"]) { animation: kit-fade 450ms ease-out both; }
  @keyframes kit-fade { from { opacity: 0; } to { opacity: 1; } }

  [data-kit-root] button, [data-kit-root] a[data-control] { transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease-out; }
  [data-kit-root] button:active:not(:disabled), [data-kit-root] a[data-control]:active { transform: translateY(3px); transition-duration: 80ms; }
  @media (hover: hover) {
    [data-kit-root] button:hover:not(:disabled), [data-kit-root] a[data-control]:hover { transform-origin: 50% 0; animation: kit-swing 600ms ease-in-out 1; }
  }
  @keyframes kit-swing { 0% { rotate: 0deg; } 25% { rotate: -3deg; } 55% { rotate: 2deg; } 80% { rotate: -1deg; } 100% { rotate: 0deg; } }

  [data-card]:not([data-screen="title"])::before { transform-origin: 50% 100%; animation: kit-string-drop 450ms cubic-bezier(0.2, 0.8, 0.3, 1) both, kit-string-sway 4.6s ease-in-out -1.3s infinite alternate; }
  [data-card]:not([data-screen="title"])::after { transform-origin: 50% 100%; animation: kit-string-drop 450ms cubic-bezier(0.2, 0.8, 0.3, 1) both, kit-string-sway 5.4s ease-in-out -3.1s infinite alternate; animation-delay: 40ms, -3.1s; }
  @keyframes kit-string-drop { 0% { translate: 0 -40px; } 60% { translate: 0 8px; } 100% { translate: 0 0; } }
  @keyframes kit-string-sway { from { transform: rotate(-1.5deg); } to { transform: rotate(1.5deg); } }

  [data-garland] [data-garland-item] { transform-origin: 50% 0; animation: kit-garland-sway 4.4s ease-in-out infinite alternate; animation-delay: calc(var(--i, 0) * -0.9s); }
  [data-garland] [data-garland-item]:nth-child(3n + 2) { animation-duration: 5.2s; }
  [data-garland] [data-garland-item]:nth-child(3n) { animation-duration: 5.9s; }
  @keyframes kit-garland-sway { from { transform: rotate(-1.5deg); } to { transform: rotate(1.5deg); } }

  [data-lift] { position: fixed; z-index: 2; box-sizing: border-box; border: 1.5px solid; pointer-events: none; animation: kit-lift 300ms cubic-bezier(0.5, 0, 0.9, 0.4) both; }
  [data-lift] i { position: absolute; bottom: 100%; width: 1.5px; background: ${STRING_COLOUR}; }
  [data-lift] i[data-side="left"] { left: 22%; }
  [data-lift] i[data-side="right"] { right: 22%; }
  @keyframes kit-lift { from { translate: 0 0; opacity: 1; } to { translate: 0 -60px; opacity: 0; } }
}

@media (prefers-reduced-motion: reduce) {
  [data-screen]:not([data-screen="play"]):not([data-screen="watch"]):not([data-screen="loading"]) { animation: kit-fade 150ms linear both; }
  @keyframes kit-fade { from { opacity: 0; } to { opacity: 1; } }
}
`;
}
