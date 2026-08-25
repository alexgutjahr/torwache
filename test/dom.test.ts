import assert from 'node:assert/strict';
import { test } from 'vitest';

import { query } from '../extension/lib/dom';

/**
 * query only needs querySelector and instanceof, so stand-ins prove its
 * behaviour without a DOM. They are typed loosely on purpose: the real
 * signature is constrained to Element, which is the point of the helper.
 */
class Button {}
class Paragraph {}

const rootOf = (nodes: Record<string, object>): ParentNode =>
  ({ querySelector: (selector: string) => nodes[selector] ?? null }) as unknown as ParentNode;

const ButtonElement = Button as unknown as { new (): HTMLButtonElement; readonly name: string };

test('query returns the element when it is the expected type', () => {
  const button = new Button();
  assert.equal(query(rootOf({ '#go': button }), '#go', ButtonElement), button);
});

test('query throws when the element is missing', () => {
  assert.throws(
    () => query(rootOf({}), '#missing', ButtonElement),
    /expected Button.*#missing/,
  );
});

test('query throws when the element is the wrong type', () => {
  assert.throws(
    () => query(rootOf({ '#go': new Paragraph() }), '#go', ButtonElement),
    /expected Button/,
  );
});
