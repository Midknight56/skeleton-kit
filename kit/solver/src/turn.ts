import { canonicalJson, createSession, type GameDef, type Json } from '@kit/core';

export interface TurnOptions {
  maxNodes?: number; // default 200000
  maxDepth?: number; // default 60
  key?: (state: Json) => Json; // default: the state
  allow?: (actionText: string) => boolean; // default: every legal action
}

export type SolveResult =
  | { solved: true; actions: string[]; nodes: number }
  | { solved: false; reason: 'exhausted' | 'node_limit' | 'depth_limit'; nodes: number };

interface Node<S> {
  state: S;
  parent: number;
  action: string;
  depth: number;
}

type SearchResult =
  | { solved: true; actions: string[]; nodes: number }
  | { solved: false; reason: 'exhausted' | 'node_limit' | 'depth_limit'; nodes: number };

/**
 * The one breadth first loop. It starts from `start`, reaches a won state in at most `maxDepth` actions,
 * and returns the first shortest list in the order of `def.actions`. Both `solveTurn` and `countFirstMoves` use it.
 */
function search<S extends Json, A>(def: GameDef<S, A>, start: S, options: TurnOptions, maxDepth: number): SearchResult {
  const maxNodes = options.maxNodes ?? 200000;
  const keyOf = options.key ?? ((state: Json) => state);
  const allow = options.allow ?? (() => true);

  const nodes: Node<S>[] = [{ state: start, parent: -1, action: '', depth: 0 }];
  const visited = new Set<string>([canonicalJson(keyOf(start))]);

  const pathTo = (index: number): string[] => {
    const path: string[] = [];
    for (let at = index; nodes[at]!.parent !== -1; at = nodes[at]!.parent) path.push(nodes[at]!.action);
    return path.reverse();
  };

  if (def.status(start).phase === 'won') return { solved: true, actions: [], nodes: 1 };

  let cutByDepth = false;
  for (let head = 0; head < nodes.length; head++) {
    const node = nodes[head]!;
    if (def.status(node.state).phase !== 'playing') continue;
    const choices = def
      .actions(node.state)
      .map((action) => ({ action, text: def.encodeAction(action) }))
      .filter((choice) => allow(choice.text));
    if (choices.length === 0) continue;
    if (node.depth >= maxDepth) {
      cutByDepth = true;
      continue;
    }
    for (const { action, text } of choices) {
      const next = def.step(node.state, action);
      const key = canonicalJson(keyOf(next));
      if (visited.has(key)) continue;
      visited.add(key);
      if (visited.size > maxNodes) return { solved: false, reason: 'node_limit', nodes: visited.size };
      nodes.push({ state: next, parent: head, action: text, depth: node.depth + 1 });
      if (def.status(next).phase === 'won') return { solved: true, actions: pathTo(nodes.length - 1), nodes: visited.size };
    }
  }
  return { solved: false, reason: cutByDepth ? 'depth_limit' : 'exhausted', nodes: visited.size };
}

/**
 * Breadth first search for a turn game. Returns the shortest list of action texts that reaches phase `won`.
 * Among lists of that length it returns the first one in the order of `def.actions`.
 * It reads no file and calls no random source.
 */
export function solveTurn<S extends Json, A>(def: GameDef<S, A>, levelId: string, seed: number, options: TurnOptions = {}): SolveResult {
  return search(def, createSession(def, levelId, seed).state, options, options.maxDepth ?? 60);
}

export interface FirstMoves {
  legal: number;
  winning: number;
}

export type FirstMovesResult =
  | { decided: true; firstMoves: FirstMoves }
  | { decided: false; reason: 'node_limit'; action: string };

/**
 * Counts the legal first actions of a level and how many of them can still lead to a won state
 * within `maxDepth` actions in total. Each first action gets its own search with its own visited set.
 * It reads no file and calls no random source.
 */
export function countFirstMoves<S extends Json, A>(def: GameDef<S, A>, levelId: string, seed: number, options: TurnOptions = {}): FirstMovesResult {
  if (def.kind !== 'turn') throw new Error(`countFirstMoves needs a turn game, but ${def.id} is a ${def.kind} game`);
  const maxDepth = options.maxDepth ?? 60;
  const allow = options.allow ?? (() => true);
  const start = createSession(def, levelId, seed).state;
  if (def.status(start).phase === 'won') return { decided: true, firstMoves: { legal: 0, winning: 0 } };

  const firsts = def
    .actions(start)
    .map((action) => ({ action, text: def.encodeAction(action) }))
    .filter((choice) => allow(choice.text));
  let winning = 0;
  for (const { action, text } of firsts) {
    const result = search(def, def.step(start, action), options, maxDepth - 1);
    if (result.solved) winning++;
    else if (result.reason === 'node_limit') return { decided: false, reason: 'node_limit', action: text };
  }
  return { decided: true, firstMoves: { legal: firsts.length, winning } };
}