import { runConformance } from '@kit/conformance';
import { createSession, validateDef, type GameDef, type Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../game.config';
import def from './def';
import { LEVELS } from './levels/levels';
import { SIZE } from './rules/state';
import { decodeAction, encodeAction } from './rules/step';

describe('the game definition', () => {
  it('has the id, the kind and the title of game.config.ts', () => {
    expect(def.id).toBe('lights');
    expect(def.kind).toBe('turn');
    expect(def.title).toBe(gameConfig.title);
  });

  it('is a valid definition', () => {
    expect(validateDef(def as unknown as GameDef<Json, unknown>)).toEqual([]);
  });

  it('has a 4 by 4 board', () => {
    expect(SIZE).toBe(4);
    expect(def.init('l1', 1).lamps).toHaveLength(16);
  });

  it('has six levels, each one playing at the start with a lamp on', () => {
    expect(def.levels().map((level) => level.id)).toEqual(['l1', 'l2', 'l3', 'l4', 'l5', 'l6']);
    for (const { id } of def.levels()) {
      const state = def.init(id, 1);
      expect(state.lamps.some((lamp) => lamp === 1), id).toBe(true);
      expect(def.status(state).phase, id).toBe('playing');
      expect(state.moves).toBe(0);
    }
  });

  it('gives level n exactly n presses, on different cells, and the first is the middle cell 1,1', () => {
    expect(LEVELS.map((level) => level.presses.length)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const level of LEVELS) {
      const cells = level.presses.map((p) => `${p.x},${p.y}`);
      expect(new Set(cells).size, level.id).toBe(cells.length);
    }
    expect(LEVELS[0]?.presses).toEqual([{ x: 1, y: 1 }]);
  });

  it('wins each level with its own list of presses, in as many moves as the list has', () => {
    for (const level of LEVELS) {
      const session = createSession(def, level.id, 1);
      for (const press of level.presses) expect(session.apply(encodeAction(press)).ok, level.id).toBe(true);
      expect(session.status().phase, level.id).toBe('won');
      expect(session.status().score, level.id).toBe(level.presses.length);
    }
  });

  it('lists 16 presses while playing and none once won', () => {
    expect(def.actions(def.init('l3', 1))).toHaveLength(16);
    const session = createSession(def, 'l1', 1);
    session.apply('press:1,1');
    expect(session.legal()).toEqual([]);
  });

  it('reads back the action texts it writes, for the 16 cells only', () => {
    for (const action of def.actions(def.init('l1', 1))) expect(decodeAction(encodeAction(action))).toEqual(action);
    for (const text of ['press:4,0', 'press:0,4', 'press:-1,0', 'press:1', 'Press:1,1', 'press: 1,1', '', 'none']) {
      expect(decodeAction(text), text).toBeNull();
    }
  });

  it('passes every property test of the kit', () => {
    const results = runConformance(def);
    expect(results).toHaveLength(9);
    const failing = results.filter((result) => !result.passed).map((result) => `${result.name}: ${result.message ?? ''}`);
    expect(failing).toEqual([]);
  });
});
