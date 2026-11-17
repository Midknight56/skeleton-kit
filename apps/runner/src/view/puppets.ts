// The cut paper puppets of the runner for its title screen: the witch on the broom hanging on three
// strings in front of a big moon, rooftops with two gaps, and pumpkins. Plain SVG strings drawn in code,
// put behind the title screen by the shell. The colours are the tokens of the look.
const BONE = '#efe7d2';
const PLUM = '#33285c';
const WARM = '#ff8a1f';
const VIOLET = '#7c63d9';
const CAPE = '#5b46b0';
const SKIN = '#f7d9b5';
const CRATER = '#ded4b9';
const ROOF = '#2a2150';
const ROOF_TOP = '#43367a';
const NIGHT = '#141026';
const SHADOW = (px: number): string => `filter:drop-shadow(0 ${px}px 0 rgb(0 0 0 / .35))`;

const f = (n: number): string => String(Math.round(n * 100) / 100);

// The witch, in a box 460 by 299 units. All shapes are flat.
const WITCH = `<g transform="rotate(-4 59.8 234.6)"><polygon points="119.6,225 119.6,244.8 0,276 16.7,234.6 0,193.2" fill="${WARM}"/></g>
<rect x="92" y="225.4" width="358.8" height="13.8" rx="6.9" fill="${PLUM}" transform="rotate(-4 92 232.3)"/>
<polygon points="239.2,119.6 239.2,190.4 69,220.8 126.9,166.2" fill="${CAPE}"/>
<polygon points="233.1,105.8 295.9,105.8 335.8,234.6 193.2,234.6" fill="${VIOLET}"/>
<circle cx="262.2" cy="87.4" r="32.2" fill="${SKIN}"/>
<ellipse cx="262.2" cy="57.5" rx="73.6" ry="11.5" fill="${VIOLET}"/>
<g transform="rotate(-8 262.2 9.2)"><polygon points="253.9,-36.8 303.6,55.2 220.8,55.2" fill="${VIOLET}"/><polygon points="229.4,31.3 290.7,31.3 298.5,46 224.2,46" fill="${WARM}"/></g>
<circle cx="342.7" cy="209.3" r="16.1" fill="${SKIN}"/>`;

// A pumpkin in a box 78 by 67.6 units: two side lobes, a middle lobe, a stem, two eyes and a mouth.
const PUMPKIN = `<rect x="33.8" y="0" width="10.4" height="16.9" rx="2.6" fill="${VIOLET}"/>
<ellipse cx="20.8" cy="40.3" rx="20.8" ry="24.7" fill="#e87210"/><ellipse cx="57.2" cy="40.3" rx="20.8" ry="24.7" fill="#e87210"/>
<ellipse cx="39" cy="39" rx="24.7" ry="28.6" fill="${WARM}"/>
<polygon points="28,28.6 33.8,40.3 22.1,40.3" fill="${NIGHT}"/><polygon points="50.1,28.6 55.9,40.3 44.2,40.3" fill="${NIGHT}"/>
<polygon points="23.4,48.1 29.6,53.1 35.9,48.1 42.1,53.1 48.4,48.1 54.6,53.1 54.6,57.2 23.4,57.2" fill="${NIGHT}"/>`;

function defs(p: string): string {
  return `<defs><g id="${p}-witch">${WITCH}</g><g id="${p}-pumpkin">${PUMPKIN}</g></defs>`;
}

const pumpkin = (p: string, x: number, y: number, w: number): string =>
  `<use href="#${p}-pumpkin" transform="translate(${x} ${y}) scale(${f(w / 78)})" style="${SHADOW(w / 20)}"/>`;

// A strand of orange string with a soft glow, from above the screen to (x, y).
const strand = (x: number, y: number): string =>
  `<line data-string x1="${x}" y1="-400" x2="${x}" y2="${y}" stroke="${WARM}" stroke-width="7" stroke-opacity=".25"/><line data-string x1="${x}" y1="-400" x2="${x}" y2="${y}" stroke="${WARM}" stroke-width="2.5"/>`;

const roof = (x: number, y: number, w: number, h: number, edge: number): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ROOF}"/><rect x="${x}" y="${y}" width="${w}" height="${edge}" fill="${ROOF_TOP}"/>`;

const hop = (x: number, y: number, w: number, h: number): string =>
  `<path d="M${x} ${y + h}A${w / 2} ${h} 0 0 1 ${x + w} ${y + h}" fill="none" stroke="${WARM}" stroke-opacity=".75" stroke-width="3" stroke-dasharray="7 7"/>`;

/** The title picture for a wide screen: 1920 by 1080 units, anchored at the right and the bottom. */
export function wideArt(): string {
  const p = 'rw';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMaxYMax slice" focusable="false">${defs(p)}
<g data-puppet><circle data-glow cx="1390" cy="410" r="371" fill="${BONE}" fill-opacity=".05"/><circle cx="1390" cy="410" r="320" fill="${BONE}"/>
<circle cx="1249.2" cy="294.8" r="64" fill="${CRATER}"/><circle cx="1518" cy="512.4" r="89.6" fill="${CRATER}"/><circle cx="1297.2" cy="547.6" r="35.2" fill="${CRATER}"/></g>
${roof(250, 852, 44, 62, 4)}${roof(1760, 858, 46, 68, 4)}${roof(0, 912, 560, 168, 8)}${roof(700, 872, 520, 208, 8)}${roof(1360, 924, 560, 156, 8)}
${hop(520, 800, 220, 112)}${hop(1180, 772, 220, 152)}
${pumpkin(p, 380, 850, 78)}${pumpkin(p, 930, 796, 96)}${pumpkin(p, 1500, 857, 84)}
<g data-puppet data-sway style="animation-duration:5.2s">${strand(1182, 476)}${strand(1406, 230)}${strand(1606, 468)}<use href="#${p}-witch" transform="translate(1160 262)" style="${SHADOW(9)}"/></g>
</svg>`;
}

/** The title picture for a narrow screen: 360 by 640 units, anchored at the top. */
export function narrowArt(): string {
  const p = 'rn';
  const s = 0.4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 640" preserveAspectRatio="xMidYMin slice" focusable="false">${defs(p)}<g transform="translate(0 140)">
<g data-puppet><circle data-glow cx="258" cy="262" r="88" fill="${BONE}" fill-opacity=".05"/><circle cx="258" cy="262" r="80" fill="${BONE}"/>
<circle cx="228" cy="237" r="16" fill="${CRATER}"/><circle cx="286" cy="289" r="22" fill="${CRATER}"/><circle cx="233" cy="296" r="9" fill="${CRATER}"/></g>
${roof(0, 430, 130, 210, 5)}${roof(190, 440, 170, 200, 5)}${roof(300, 410, 24, 30, 3)}
${hop(100, 395, 120, 45)}
${pumpkin(p, 245, 396, 44)}
<g data-puppet data-sway style="animation-duration:5.2s">${strand(173, 262)}${strand(262, 174)}${strand(342, 260)}<use href="#${p}-witch" transform="translate(164 215) scale(${s})" style="${SHADOW(4)}"/></g>
</g></svg>`;
}
