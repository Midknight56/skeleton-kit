export declare const ruleCodeFiles: string[];
export declare function ruleCodeBlock(files?: string[]): {
  files: string[];
  ignores: string[];
  rules: Record<string, ['error', ...object[]]>;
};
