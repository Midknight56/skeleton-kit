import type { Observation } from '@kit/core';
import type { GardenState } from './state';

export function observe(state: GardenState): Observation {
  const lanterns: { id: number; x: number; y: number }[] = [];
  const homeAt = new Set(state.moths.filter((moth) => moth.home).map((moth) => `${moth.x},${moth.y}`));
  const outAt = new Set(state.moths.filter((moth) => !moth.home).map((moth) => `${moth.x},${moth.y}`));
  let flowersFree = 0;

  const textMap = state.cells.map((row, y) => {
    let line = '';
    for (let x = 0; x < row.length; x++) {
      const ch = row.charAt(x);
      const key = `${x},${y}`;
      if (ch >= '1' && ch <= '5') lanterns.push({ id: Number(ch), x, y });
      if (ch === 'f' && !homeAt.has(key)) flowersFree++;
      if (outAt.has(key)) line += 'm';
      else if (homeAt.has(key)) line += 'F';
      else if (ch === String(state.lit)) line += '*';
      else line += ch;
    }
    return line;
  });
  lanterns.sort((a, b) => a.id - b.id);

  const legend: Record<string, string> = {
    '#': 'hedge',
    '.': 'grass',
    w: 'web, a moth that flies onto it is caught',
    f: 'flower',
    F: 'flower with a home moth',
    '*': 'lit lantern',
    m: 'moth that is not home',
  };
  for (const lantern of lanterns) legend[String(lantern.id)] = `lantern ${lantern.id}, not lit`;

  const home = state.moths.filter((moth) => moth.home).length;
  const lit = state.lit === 0 ? 'No lantern is lit.' : `Lantern ${state.lit} is lit.`;
  return {
    summary: `Turn ${state.turn} of ${state.maxTurns}. ${lit} ${home} of ${state.moths.length} moths home.`,
    textMap,
    legend,
    facts: {
      turn: state.turn,
      maxTurns: state.maxTurns,
      lit: state.lit,
      moths: state.moths.map((moth) => ({ id: moth.id, x: moth.x, y: moth.y, home: moth.home, caught: moth.caught })),
      lanterns,
      flowersFree,
    },
  };
}
