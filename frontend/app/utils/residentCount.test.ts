import { test } from "node:test";
import assert from "node:assert/strict";
import {
  residentCountStatus,
  RESIDENT_COUNT_MATCH_MESSAGE,
  RESIDENT_COUNT_MISMATCH_MESSAGE,
} from "./residentCount.ts";

test("reports a match when the live count equals the snapshot total", () => {
  assert.equal(residentCountStatus(120, 120), "match");
});

test("reports a mismatch when the live count is higher than the snapshot", () => {
  assert.equal(residentCountStatus(125, 120), "mismatch");
});

test("reports a mismatch when the live count is lower than the snapshot", () => {
  assert.equal(residentCountStatus(118, 120), "mismatch");
});

test("reports unknown when either side is missing", () => {
  assert.equal(residentCountStatus(undefined, 120), "unknown");
  assert.equal(residentCountStatus(120, undefined), "unknown");
  assert.equal(residentCountStatus(null, null), "unknown");
});

test("reports unknown for non-finite values", () => {
  assert.equal(residentCountStatus(Number.NaN, 120), "unknown");
  assert.equal(residentCountStatus(120, Number.NaN), "unknown");
  assert.equal(residentCountStatus(Infinity, 120), "unknown");
});

test("treats a zero count as comparable", () => {
  assert.equal(residentCountStatus(0, 0), "match");
  assert.equal(residentCountStatus(0, 3), "mismatch");
});

test("exposes the exact user-facing messages", () => {
  assert.equal(
    RESIDENT_COUNT_MISMATCH_MESSAGE,
    "Resident census data has changed since this analysis was generated. Regenerate the analysis to update the figures.",
  );
  assert.equal(RESIDENT_COUNT_MATCH_MESSAGE, "Resident count is up to date");
});
