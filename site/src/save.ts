// SPDX-License-Identifier: GPL-3.0-or-later
import type { DownloadFile } from './downloads';

/**
 * How long the object URL outlives the click. Revoking it right away can cancel the download
 * in some engines, because the browser reads the blob only after the click has returned.
 */
const REVOKE_DELAY = 40_000;

/** Offers the file as a download through a temporary `<a download>`. */
export function saveFile(file: DownloadFile): void {
  const part: BlobPart = typeof file.data === 'string' ? file.data : new Uint8Array(file.data);
  const url = URL.createObjectURL(new Blob([part], { type: file.mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.fileName;
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
}

/** Copies text to the clipboard; `false` when the Clipboard API is missing or refuses. */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = (globalThis.navigator as Navigator | undefined)?.clipboard;
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
