export interface Rule { selector: string; body: string }

export function rulesOf(css: string): Rule[] {
  const rules: Rule[] = [];
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push({ selector: m[1]!.trim().replace(/\s+/g, ' '), body: m[2]! });
  return rules;
}
