import { gunzipSync, gzipSync } from 'node:zlib';

const MAGIC = 'TQ1' as const;
const FORMAT_VERSION = 1 as const;
export const MAX_TQ1_DEPTH = 1_024;

type Scalar = null | boolean | number;
type Encoded = Scalar | EncodedSequence;
interface EncodedSequence extends Array<Scalar | string | EncodedSequence> {
  0: '$' | 'a' | 'o';
}

interface Envelope {
  magic: typeof MAGIC;
  version: typeof FORMAT_VERSION;
  strings: string[];
  data: Encoded;
}

export interface Tq1EncodeOptions {
  readonly compressionLevel?: number;
  readonly maxDepth?: number;
}

export interface Tq1DecodeLimits {
  readonly maxCompressedBytes: number;
  readonly maxExpandedBytes: number;
  readonly maxDepth: number;
  readonly maxStrings: number;
  readonly maxArrayLength: number;
  readonly maxObjectProperties: number;
}

export interface Tq1DecodeOptions {
  readonly limits?: Partial<Tq1DecodeLimits>;
}

export const DEFAULT_TQ1_DECODE_LIMITS: Tq1DecodeLimits = Object.freeze({
  maxCompressedBytes: 64 * 1024 * 1024,
  maxExpandedBytes: 256 * 1024 * 1024,
  maxDepth: 512,
  maxStrings: 1_000_000,
  maxArrayLength: 10_000_000,
  maxObjectProperties: 10_000_000
});

export class Tq1Error extends Error {
  readonly code: 'INVALID_DATA' | 'LIMIT_EXCEEDED' | 'UNSUPPORTED_VERSION';

  constructor(code: Tq1Error['code'], message: string, options: { cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'Tq1Error';
    this.code = code;
  }
}

function pack(value: unknown, intern: (value: string) => number, seen: WeakSet<object>, depth: number, maxDepth: number): Encoded {
  if (depth > maxDepth) throw new Tq1Error('LIMIT_EXCEEDED', 'TQ1 nesting depth exceeds the configured encoding limit');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Tq1Error('INVALID_DATA', 'TQ1 only accepts finite JSON numbers');
    return value;
  }
  if (typeof value === 'string') return ['$', intern(value)];
  if (typeof value !== 'object') throw new Tq1Error('INVALID_DATA', `TQ1 cannot encode ${typeof value}`);
  if (seen.has(value)) throw new Tq1Error('INVALID_DATA', 'TQ1 cannot encode cyclic values');
  seen.add(value);
  try {
    if (Array.isArray(value)) return ['a', ...value.map((item) => pack(item, intern, seen, depth + 1, maxDepth))];
    const entries = Object.entries(value as Record<string, unknown>);
    return ['o', ...entries.flatMap(([key, child]) => [intern(key), pack(child, intern, seen, depth + 1, maxDepth)])];
  } finally {
    seen.delete(value);
  }
}

function unpack(value: Encoded, strings: string[], limits: Tq1DecodeLimits, depth: number): unknown {
  if (depth > limits.maxDepth) throw new Tq1Error('LIMIT_EXCEEDED', 'TQ1 nesting depth exceeds the configured limit');
  if (!Array.isArray(value)) {
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
    throw new Tq1Error('INVALID_DATA', 'TQ1 contains an invalid scalar');
  }
  const [tag, ...items] = value;
  if (tag === '$') {
    if (items.length !== 1 || typeof items[0] !== 'number' || !Number.isSafeInteger(items[0])) {
      throw new Tq1Error('INVALID_DATA', 'Invalid TQ1 string reference');
    }
    const decoded = strings[items[0]];
    if (decoded === undefined) throw new Tq1Error('INVALID_DATA', 'TQ1 string index is out of bounds');
    return decoded;
  }
  if (tag === 'a') {
    if (items.length > limits.maxArrayLength) throw new Tq1Error('LIMIT_EXCEEDED', 'TQ1 array exceeds the configured limit');
    return items.map((item) => unpack(item as Encoded, strings, limits, depth + 1));
  }
  if (tag === 'o') {
    if (items.length % 2 !== 0) throw new Tq1Error('INVALID_DATA', 'TQ1 object contains an incomplete entry');
    if (items.length / 2 > limits.maxObjectProperties) throw new Tq1Error('LIMIT_EXCEEDED', 'TQ1 object exceeds the configured limit');
    const output: Record<string, unknown> = {};
    for (let index = 0; index < items.length; index += 2) {
      const keyIndex = items[index];
      if (typeof keyIndex !== 'number' || !Number.isSafeInteger(keyIndex)) throw new Tq1Error('INVALID_DATA', 'Invalid TQ1 object key');
      const key = strings[keyIndex];
      if (key === undefined) throw new Tq1Error('INVALID_DATA', 'TQ1 key index is out of bounds');
      if (Object.hasOwn(output, key)) throw new Tq1Error('INVALID_DATA', `Duplicate TQ1 object key: ${key}`);
      Object.defineProperty(output, key, {
        value: unpack(items[index + 1] as Encoded, strings, limits, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    return output;
  }
  throw new Tq1Error('INVALID_DATA', `Unknown TQ1 tag: ${String(tag)}`);
}

export function encodeTq1(value: unknown, options: Tq1EncodeOptions = {}): Buffer {
  const compressionLevel = options.compressionLevel ?? 9;
  const maxDepth = options.maxDepth ?? DEFAULT_TQ1_DECODE_LIMITS.maxDepth;
  if (!Number.isInteger(compressionLevel) || compressionLevel < -1 || compressionLevel > 9) {
    throw new Tq1Error('INVALID_DATA', 'compressionLevel must be an integer from -1 through 9');
  }
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > MAX_TQ1_DEPTH) {
    throw new Tq1Error('INVALID_DATA', `maxDepth must be a safe integer from 0 through ${MAX_TQ1_DEPTH}`);
  }
  const strings: string[] = [];
  const indexes = new Map<string, number>();
  const intern = (text: string): number => {
    const known = indexes.get(text);
    if (known !== undefined) return known;
    const index = strings.length;
    strings.push(text);
    indexes.set(text, index);
    return index;
  };
  const envelope: Envelope = {
    magic: MAGIC,
    version: FORMAT_VERSION,
    strings,
    data: pack(value, intern, new WeakSet(), 0, maxDepth)
  };
  return gzipSync(JSON.stringify(envelope), { level: compressionLevel });
}

export function decodeTq1(input: Uint8Array, options: Tq1DecodeOptions = {}): unknown {
  if (!(input instanceof Uint8Array)) throw new Tq1Error('INVALID_DATA', 'TQ1 input must be a Uint8Array');
  const limits = { ...DEFAULT_TQ1_DECODE_LIMITS, ...options.limits };
  for (const key of ['maxCompressedBytes', 'maxExpandedBytes', 'maxStrings', 'maxArrayLength', 'maxObjectProperties'] as const) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] <= 0) {
      throw new Tq1Error('INVALID_DATA', `${key} must be a positive safe integer`);
    }
  }
  if (!Number.isSafeInteger(limits.maxDepth) || limits.maxDepth < 0 || limits.maxDepth > MAX_TQ1_DEPTH) {
    throw new Tq1Error('INVALID_DATA', `maxDepth must be a safe integer from 0 through ${MAX_TQ1_DEPTH}`);
  }
  if (input.byteLength > limits.maxCompressedBytes) throw new Tq1Error('LIMIT_EXCEEDED', 'TQ1 payload exceeds the compressed-byte limit');
  let expanded: Buffer;
  try {
    expanded = gunzipSync(input, { maxOutputLength: limits.maxExpandedBytes });
  } catch (error) {
    throw new Tq1Error('INVALID_DATA', 'TQ1 gzip payload is invalid or exceeds its expanded-byte limit', { cause: error });
  }
  let envelope: unknown;
  try {
    envelope = JSON.parse(expanded.toString('utf8'));
  } catch (error) {
    throw new Tq1Error('INVALID_DATA', 'TQ1 envelope is not valid JSON', { cause: error });
  }
  if (typeof envelope !== 'object' || envelope === null) throw new Tq1Error('INVALID_DATA', 'TQ1 envelope must be an object');
  const candidate = envelope as Partial<Envelope>;
  if (candidate.magic !== MAGIC) throw new Tq1Error('INVALID_DATA', 'TQ1 magic header is missing');
  if (candidate.version !== FORMAT_VERSION) throw new Tq1Error('UNSUPPORTED_VERSION', `Unsupported TQ1 version: ${String(candidate.version)}`);
  if (!Array.isArray(candidate.strings) || candidate.strings.some((value) => typeof value !== 'string')) {
    throw new Tq1Error('INVALID_DATA', 'TQ1 string table is invalid');
  }
  if (candidate.strings.length > limits.maxStrings) throw new Tq1Error('LIMIT_EXCEEDED', 'TQ1 string table exceeds the configured limit');
  return unpack(candidate.data as Encoded, candidate.strings, limits, 0);
}
