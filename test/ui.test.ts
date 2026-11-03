import assert from "node:assert/strict";
import { test } from "node:test";
import { moveSelection } from "../src/ui.js";

test("navigation stays at zero before projects load and with an empty registry", () => {
  assert.equal(moveSelection(0, 0, "down"), 0);
  assert.equal(moveSelection(0, 0, "up"), 0);
});

test("navigation clamps to the available project range", () => {
  assert.equal(moveSelection(0, 2, "up"), 0);
  assert.equal(moveSelection(0, 2, "down"), 1);
  assert.equal(moveSelection(1, 2, "down"), 1);
});
