// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readLevelFacts } from './level-facts';

const setup = (json: string | null) => {
  document.head.innerHTML = json === null ? '' : `<script type="application/json" id="kit-level-facts">${json}</script>`;
  return readLevelFacts(document);
};

describe('readLevelFacts of the page', () => {
  it('parses the tag into a map from level id to facts', () => {
    const facts = setup('{"game":"g","levels":{"a":{"actions":2,"firstMoves":{"legal":2,"winning":1}},"b":{"actions":9}}}');
    expect(facts.size).toBe(2);
    expect(facts.get('a')).toEqual({ actions: 2, firstMoves: { legal: 2, winning: 1 } });
    expect(facts.get('b')).toEqual({ actions: 9 });
  });

  it('gives an empty map when the tag is missing', () => {
    expect(setup(null).size).toBe(0);
  });

  it.each([['{ nope'], ['[]'], ['null'], ['{"levels":3}'], ['{"levels":{"a":{"actions":"2"}}}'], ['{"levels":{"a":{"actions":2,"firstMoves":{"legal":1}}}}']])(
    'gives an empty map or skips the item for damaged data %s',
    (json) => {
      expect(setup(json).get('a')).toBeUndefined();
    },
  );

  it('keeps a good item beside a damaged one', () => {
    const facts = setup('{"levels":{"a":{"actions":"x"},"b":{"actions":4}}}');
    expect(facts.get('b')).toEqual({ actions: 4 });
    expect(facts.has('a')).toBe(false);
  });
});
describe('the window of a tick level in the page', () => {
  it('reads a whole number window', () => {
    expect(setup('{"levels":{"r":{"actions":687,"window":9}}}').get('r')).toEqual({ actions: 687, window: 9 });
  });

  it.each([['"9"'], ['0.5'], ['-1'], ['null']])('skips a damaged window %s and keeps actions', (value) => {
    expect(setup('{"levels":{"r":{"actions":687,"window":' + value + '}}}').get('r')).toEqual({ actions: 687 });
  });
});
