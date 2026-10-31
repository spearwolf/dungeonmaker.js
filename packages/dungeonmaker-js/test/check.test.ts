// SPDX-License-Identifier: GPL-3.0-or-later
import { checkDesign } from '../src/config/check.js';
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

test('size up/down rule follows the repeated last value', () => {
  const d = vendorConfig('design');
  d.tunnelers.sizeUpProbability = [0, 50];
  d.tunnelers.sizeDownProbability = [0, 0, 60];
  expect(checkDesign(d).map((i) => i.path)).toEqual(['/tunnelers/sizeUpProbability/2']);
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
