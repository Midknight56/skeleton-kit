// The cut paper puppets of the garden puzzle for its title screen: one lit lantern, moths on strings,
// flowers on a hill and webs. Each is a few flat shapes. The pictures are plain SVG strings, drawn in
// code, and the shell puts them behind the title screen. The colours are the tokens of the look.
const BONE = '#efe7d2';
const PLUM = '#33285c';
const WARM = '#ff8a1f';
const FLAME = '#ffe2a8';
const LILAC = '#b7a1ff';
const STRING = 'rgb(239 231 210 / .38)';
const SHADOW = 'filter:drop-shadow(0 3px 0 rgb(0 0 0 / .35))';

const f = (n: number): string => String(Math.round(n * 100) / 100);

// The moth is cut from one polygon, in a box 105.6 by 79.2 units.
const MOTH_POINTS = [[50, 22], [62, 0], [100, 8], [92, 48], [78, 58], [84, 92], [60, 100], [50, 74], [40, 100], [16, 92], [22, 58], [8, 48], [0, 8], [38, 0]]
  .map(([x, y]) => `${f(((x as number) / 100) * 105.6)},${f(((y as number) / 100) * 79.2)}`)
  .join(' ');

function defs(p: string): string {
  return `<defs>
<g id="${p}-moth"><polygon points="${MOTH_POINTS}" fill="${BONE}"/><rect x="47.3" y="8.8" width="11" height="59.4" rx="6.6" fill="${PLUM}"/><circle cx="25.3" cy="25.3" r="7.7" fill="${WARM}"/><circle cx="80.3" cy="25.3" r="7.7" fill="${WARM}"/></g>
<g id="${p}-lantern"><path d="M50.4 61.6V39.2A33.6 33.6 0 0 1 117.6 39.2V61.6" fill="none" stroke="${BONE}" stroke-width="11.2"/><rect x="28" y="56" width="112" height="28" rx="11.2" fill="${BONE}"/><rect x="11.2" y="84" width="145.6" height="145.6" rx="33.6" fill="${WARM}"/><ellipse cx="84" cy="156.8" rx="21.8" ry="40.7" fill="${FLAME}"/><rect x="44.8" y="229.6" width="78.4" height="28" rx="11.2" fill="${BONE}"/></g>
<radialGradient id="${p}-glow"><stop offset="0" stop-color="${WARM}" stop-opacity=".45"/><stop offset="1" stop-color="${WARM}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-bloom"><stop offset="0" stop-color="${LILAC}" stop-opacity=".4"/><stop offset="1" stop-color="${LILAC}" stop-opacity="0"/></radialGradient>
<clipPath id="${p}-cut"><polygon points="96,0 224,0 320,96 320,224 224,320 96,320 0,224 0,96"/></clipPath>
<g id="${p}-web"><g clip-path="url(#${p}-cut)" fill="none" stroke="${BONE}"><circle cx="160" cy="160" r="37.6" stroke-width="4.8" stroke-opacity=".5"/><circle cx="160" cy="160" r="77.6" stroke-width="4.8" stroke-opacity=".5"/><circle cx="160" cy="160" r="117.6" stroke-width="4.8" stroke-opacity=".5"/><circle cx="160" cy="160" r="157.6" stroke-width="4.8" stroke-opacity=".5"/><path d="M160 0V320M0 160H320M47 47L273 273M273 47L47 273" stroke-width="3" stroke-opacity=".6"/></g></g>
</defs>`;
}

// A moth on a string. (cx, cy) is the middle of the moth, `w` its width in px, `turn` its angle.
function moth(p: string, cx: number, cy: number, w: number, turn: number, delay: number): string {
  const s = w / 105.6;
  return `<g data-puppet data-sway style="animation-delay:-${delay}s;animation-duration:${4 + (delay % 2)}s"><line data-string x1="${cx}" y1="-400" x2="${cx}" y2="${cy}" stroke="${STRING}" stroke-width="1.5"/><use href="#${p}-moth" transform="translate(${cx} ${cy}) rotate(${turn}) scale(${f(s)}) translate(-52.8 -39.6)" style="${SHADOW}"/></g>`;
}

function lantern(p: string, cx: number, top: number, s: number, glow = 260): string {
  const body = { x: cx, y: top + 156 * s };
  return `<g data-puppet><circle data-glow cx="${f(body.x)}" cy="${f(body.y)}" r="${f(glow * s)}" fill="url(#${p}-glow)"/><g data-sway style="animation-duration:5.4s"><line data-string x1="${cx}" y1="-400" x2="${cx}" y2="${f(top)}" stroke="${STRING}" stroke-width="1.5"/><use href="#${p}-lantern" transform="translate(${f(cx - 84 * s)} ${f(top)}) scale(${s})" style="${SHADOW}"/></g></g>`;
}

function flower(p: string, cx: number, cy: number, r: number): string {
  const d = 2 * r;
  const petals = [[d, 0], [-d, 0], [0, d], [0, -d]].map(([x, y]) => `<circle cx="${cx + (x as number)}" cy="${cy + (y as number)}" r="${f(r * 1.5)}" fill="${LILAC}"/>`).join('');
  return `<g data-puppet><circle data-glow cx="${cx}" cy="${cy}" r="${f(r * 3)}" fill="url(#${p}-bloom)"/>${petals}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BONE}"/></g>`;
}

const web = (p: string, x: number, y: number, size: number): string => `<g data-puppet><use href="#${p}-web" transform="translate(${x} ${y}) scale(${f(size / 320)})"/></g>`;

/** The title picture for a wide screen: 1920 by 1080 units, anchored at the right and the bottom. */
export function wideArt(): string {
  const p = 'gw';
  const moths: [number, number, number, number][] = [[1010, 300, 105.6, 75], [1120, 520, 76.8, 40], [1420, 250, 86.4, -60], [1545, 470, 115.2, -95], [1335, 612, 72, -10], [980, 566, 62.4, 60], [1665, 300, 67.2, -70]];
  const flowers: [number, number, number][] = [[900, 846, 15], [1090, 806, 12], [1300, 784, 16], [1520, 784, 13], [1730, 806, 15]];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMaxYMax slice" style="overflow:visible" focusable="false">${defs(p)}
<ellipse cx="1410" cy="1110" rx="850" ry="350" fill="#1c1534"/>
${web(p, 1670, -50, 320)}${web(p, 1705, 555, 170)}
${flowers.map(([x, y, r]) => flower(p, x, y, r)).join('')}
${lantern(p, 1270, 232, 1)}
${moths.map(([x, y, w, t], i) => moth(p, x, y, w, t, i + 1)).join('')}
</svg>`;
}

/** The title picture for a narrow screen: 360 by 640 units, anchored at the top. */
export function narrowArt(): string {
  const p = 'gn';
  const moths: [number, number, number, number][] = [[318, 120, 40, -60], [226, 215, 44, 40], [312, 305, 50, 80], [236, 120, 32, 20]];
  const flowers: [number, number, number][] = [[60, 405, 8], [190, 412, 10], [315, 404, 8]];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMin slice" style="overflow:visible" focusable="false">${defs(p)}<g transform="translate(0 140)">
<ellipse cx="190" cy="500" rx="300" ry="120" fill="#1c1534"/>
${web(p, 292, 375, 70)}
${flowers.map(([x, y, r]) => flower(p, x, y, r)).join('')}
${lantern(p, 272, 140, 0.5, 190)}
${moths.map(([x, y, w, t], i) => moth(p, x, y, w, t, i + 1)).join('')}
</g></svg>`;
}

// One level on the garland, in a box 34 by 50. A lit one is a finished level.
const PICTURE_SHACKLE = `<path d="M10.5 12V7.6A6.6 6.6 0 0 1 23.7 7.6V12" fill="none" stroke="${BONE}" stroke-width="2.2"/><rect x="6.1" y="10.9" width="21.7" height="5.4" rx="2.2" fill="${BONE}"/>`;
const PICTURE_BASE = `<rect x="9.4" y="44.5" width="15.2" height="5.4" rx="2.2" fill="${BONE}"/>`;

export const garlandLit = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 50" style="overflow:visible" focusable="false"><circle cx="17" cy="30" r="21" fill="${WARM}" fill-opacity=".22"/>${PICTURE_SHACKLE}<rect x="2.9" y="16.3" width="28.3" height="28.3" rx="6.5" fill="${WARM}"/><ellipse cx="17" cy="30.4" rx="4.2" ry="7.9" fill="${FLAME}"/>${PICTURE_BASE}</svg>`;

export const garlandUnlit = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 50" focusable="false">${PICTURE_SHACKLE}<rect x="2.9" y="16.3" width="28.3" height="28.3" rx="6.5" fill="${PLUM}"/><rect x="12.9" y="23" width="8.2" height="14" rx="3.4" fill="#221a3d"/>${PICTURE_BASE}</svg>`;
