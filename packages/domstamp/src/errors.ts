export type DomstampErrorCode =
  | 'ABORTED'
  | 'CAPTURE_FAILED'
  | 'INVALID_CONFIG'
  | 'INVALID_SNAPSHOT'
  | 'PLUGIN_FAILED'
  | 'TIMEOUT'
  | 'UNSUPPORTED_CAPABILITY'
  | 'UNSUPPORTED_SCHEMA';

export class DomstampError extends Error {
  readonly code: DomstampErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: DomstampErrorCode,
    message: string,
    options: { cause?: unknown; details?: Readonly<Record<string, unknown>> } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'DomstampError';
    this.code = code;
    this.details = options.details ?? {};
  }
}

export function isDomstampError(value: unknown): value is DomstampError {
  return value instanceof DomstampError;
}
