export type KitErrorCode = 'unknown_level' | 'bad_seed' | 'not_plain_data';

export class KitError extends Error {
  code: KitErrorCode;
  path?: string;

  constructor(code: KitErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'KitError';
    this.code = code;
    if (path !== undefined) this.path = path;
  }
}
