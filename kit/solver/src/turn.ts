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

/**
 * Breadth first search for a turn game. Returns the shortest list of action texts that reaches phase `won`.
 * Among lists of that length it returns the first one in the order of `def.actions`.
 * It reads no file and calls no random source.
 */
export function solveTurn<S extends Json, A>(def: GameDef<S, A>, levelId: string, seed: number, options: TurnOptions = {}): SolveResult {
  const maxNodes = options.maxNodes ?? 200000;
  const maxDepth = options.maxDepth ?? 60;
  const keyOf = options.key ?? ((state: Json) => state);
  const allow = options.allow ?? (() => true);

  const start = createSession(def, levelId, seed).state;
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
