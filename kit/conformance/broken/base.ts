// Shared parts of the three broken sample games. Each broken game breaks exactly one rule of the contract.
import type { Observation, Scene, Viewport } from '@kit/core';

export function plainObserve(n: number): Observation {
  return { summary: `The counter is ${n}.`, textMap: [String(n)], legend: { '0': 'the counter' }, facts: { n } };
}

export function plainView(viewport: Viewport): Scene {
  return {
    width: viewport.width,
    height: viewport.height,
    items: [{ kind: 'rect', id: 'counter', layer: 'world', x: 1, y: 1, w: 4, h: 4, fill: '#ffffff' }],
  };
}
