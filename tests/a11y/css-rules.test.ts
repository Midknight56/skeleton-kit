import { describe, expect, it } from 'vitest';
import { rulesOf } from './css-rules';

// Task 1 of .kiro/specs/final-mend. The rule reader of the contrast test ignores CSS comments.

describe('the CSS rule reader', () => {
  it('reads a rule with no comment', () => {
    expect(rulesOf('[data-garland] { background: #110d21; }')).toEqual([{ selector: '[data-garland]', body: ' background: #110d21; ' }]);
  });

  it('does not take a comment above a rule as part of its selector', () => {
    const rules = rulesOf('a { color: red; }\n/* Text is never smaller than 12 px. */\n[data-garland] { background: #110d21; }');
    expect(rules.map((rule) => rule.selector)).toEqual(['a', '[data-garland]']);
  });

  it('ignores a comment inside a rule body and a comment that spans lines', () => {
    const rules = rulesOf('/* one\n   two */\nb { /* note */ color: blue; }');
    expect(rules).toHaveLength(1);
    expect(rules[0]!.selector).toBe('b');
    expect(rules[0]!.body).not.toContain('note');
    expect(rules[0]!.body).toContain('color: blue;');
  });
});
