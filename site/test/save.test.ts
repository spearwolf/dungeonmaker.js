// SPDX-License-Identifier: GPL-3.0-or-later
import { copyText, saveFile } from '../src/save';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('saveFile clicks an <a download> with an object URL and revokes it afterwards', async () => {
  vi.useFakeTimers();
  const anchor = { href: '', download: '', rel: '', click: vi.fn() };
  vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
  let blob: Blob | undefined;
  const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    blob = b as Blob;
    return 'blob:test';
  });
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  saveFile({
    fileName: 'design3A-42.bin',
    mime: 'application/octet-stream',
    data: Uint8Array.of(1, 2, 3),
  });

  expect(create).toHaveBeenCalledOnce();
  expect(blob?.type).toBe('application/octet-stream');
  expect(new Uint8Array(await (blob as Blob).arrayBuffer())).toEqual(Uint8Array.of(1, 2, 3));
  expect(anchor).toMatchObject({ href: 'blob:test', download: 'design3A-42.bin' });
  expect(anchor.click).toHaveBeenCalledOnce();
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:test');
});

test('saveFile writes strings as text', async () => {
  vi.stubGlobal('document', { createElement: () => ({ click() {} }) });
  let blob: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    blob = b as Blob;
    return 'blob:text';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  saveFile({ fileName: 'a.txt', mime: 'text/plain;charset=utf-8', data: 'héllo\n' });
  expect(await (blob as Blob).text()).toBe('héllo\n');
});

test('copyText reports whether the clipboard took the text', async () => {
  const writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  expect(await copyText('pnpm dlx dungeonmaker-js')).toBe(true);
  expect(writeText).toHaveBeenCalledWith('pnpm dlx dungeonmaker-js');

  writeText.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
  expect(await copyText('x')).toBe(false);

  vi.stubGlobal('navigator', {});
  expect(await copyText('x')).toBe(false);
});
