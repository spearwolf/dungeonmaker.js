// SPDX-License-Identifier: GPL-3.0-or-later
import { checkDesign } from '../src/config/check.js';
import { parseDesignText } from '../src/config/parse.js';
import { toDesignText } from '../src/config/serialize.js';
import { DesignValidationError } from '../src/errors.js';
import type { DesignConfig } from '../src/schema/model.js';
import { BROKEN_DESIGNS } from './fixtures/broken-designs.js';
import { caught, DESIGNS, vendorConfig } from './helpers.js';

test.each(DESIGNS)('%s satisfies all semantic rules', (name) => {
  expect(checkDesign(vendorConfig(name))).toEqual([]);
});

test.each(BROKEN_DESIGNS.filter((b) => b.stage === 'check'))(
  '$name: toDesignText rejects, never throws anything else',
  (broken) => {
    const d = structuredClone(vendorConfig('design5'));
    broken.mutate(d);
    const e = caught(() => toDesignText(d));
    expect(e).toBeInstanceOf(DesignValidationError);
    if (broken.path !== undefined) {
      expect((e as DesignValidationError).issues.map((i) => i.path)).toContain(broken.path);
    }
  },
);

test.each([null, undefined, 42, 'design', {}, { map: {} }])(
  'garbage %j is a DesignValidationError',
  (value) => {
    expect(caught(() => toDesignText(value as unknown as DesignConfig))).toBeInstanceOf(
      DesignValidationError,
    );
  },
);

test('size up/down rule follows the repeated last value and points at an existing element', () => {
  const d = vendorConfig('design');
  d.tunnelers.sizeUpProbability = [0, 50];
  d.tunnelers.sizeDownProbability = [0, 0, 60];
  // generation 2 uses the repeated sizeUp[1]; sizeUp has no element 2, sizeDown has
  expect(checkDesign(d).map((i) => i.path)).toEqual(['/tunnelers/sizeDownProbability/2']);
});

test('the smallest normal aspect ratio is accepted and survives the round trip', () => {
  const d = vendorConfig('design');
  d.rooms.aspectRatio = 2.2250738585072014e-308;
  expect(parseDesignText(toDesignText(d)).rooms.aspectRatio).toBe(2.2250738585072014e-308);
});

test('a subnormal aspect ratio is rejected before the core sees it', () => {
  const d = vendorConfig('design');
  d.rooms.aspectRatio = 2.2250738585072e-308;
  const e = caught(() => toDesignText(d));
  expect(e).toBeInstanceOf(DesignValidationError);
  expect((e as DesignValidationError).issues.map((i) => i.path)).toEqual(['/rooms/aspectRatio']);
});

test('checkDesign reports every violation, not just the first', () => {
  const d = vendorConfig('design5');
  d.map.width = 5000;
  d.map.height = 2;
  d.crawlers.stepLength = [];
  expect(checkDesign(d).map((i) => i.path)).toEqual(
    expect.arrayContaining(['/map/width', '/map/height', '/crawlers/stepLength']),
  );
});
