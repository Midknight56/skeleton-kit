export interface PageFacts {
  game: string;
  levels: Record<string, { actions: number; firstMoves?: { legal: number; winning: number } }>;
}
export declare function readLevelFacts(repoRoot: string, gameId: string): PageFacts;
export declare function levelFactsPlugin(repoRoot: string): import('vite').Plugin;
