// The two fonts of the look. Both files are kept in assets/fonts/ (SIL Open Font License 1.1) and the
// build copies them to /fonts/ of the site. A page loads them from its own host with a relative url.
export const FONT_FILES = ['BricolageGrotesque.ttf', 'SometypeMono.ttf'] as const;

// A game page sits one folder below the site root, so the fonts are one folder up.
export const FONT_DIR = '../fonts/';

export const FONT_TEXT = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_CODE = '"Sometype Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';

export function fontFaceCss(dir: string = FONT_DIR): string {
  return [
    `@font-face { font-family: "Bricolage Grotesque"; src: url("${dir}${FONT_FILES[0]}") format("truetype"); font-weight: 200 800; font-style: normal; font-display: swap; }`,
    `@font-face { font-family: "Sometype Mono"; src: url("${dir}${FONT_FILES[1]}") format("truetype"); font-weight: 400 700; font-style: normal; font-display: swap; }`,
  ].join('\n');
}
