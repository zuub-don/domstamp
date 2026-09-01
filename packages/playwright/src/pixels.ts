import { createHash } from 'node:crypto';
import type { SnapshotAttachment } from 'domstamp';
import type { Frame, Page } from 'playwright-core';

export interface PixelCaptureOptions {
  readonly format: 'jpeg' | 'png';
  readonly quality?: number;
  readonly fullPage: boolean;
  readonly scale: 'css' | 'device';
  readonly maskSelectors?: readonly string[];
  readonly maskColor?: string;
  readonly signal?: AbortSignal;
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

export async function captureScreenshotAttachment(
  page: Page,
  frames: readonly Frame[],
  options: PixelCaptureOptions
): Promise<SnapshotAttachment> {
  const masks = (options.maskSelectors ?? []).flatMap((selector) => frames.map((frame) => frame.locator(selector)));
  const bytes = await page.screenshot({
    type: options.format,
    animations: 'disabled',
    caret: 'hide',
    fullPage: options.fullPage,
    scale: options.scale,
    ...(options.format === 'jpeg' && options.quality !== undefined ? { quality: options.quality } : {}),
    ...(masks.length === 0 ? {} : { mask: masks }),
    ...(options.maskColor === undefined ? {} : { maskColor: options.maskColor }),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  });
  const dimensions = options.format === 'png' ? pngDimensions(bytes) : jpegDimensions(bytes);
  if (!dimensions) throw new Error(`Unable to read ${options.format} screenshot dimensions`);
  return {
    id: 'screenshot-0',
    kind: 'screenshot',
    frameId: 'frame-0',
    mediaType: options.format === 'png' ? 'image/png' : 'image/jpeg',
    encoding: 'base64',
    data: bytes.toString('base64'),
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: dimensions.width,
    height: dimensions.height
  };
}
