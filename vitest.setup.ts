import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL does not auto-register cleanup between tests unless Vitest's globals
// are enabled (they aren't in this project's vitest.config.ts) — without
// this, multiple render() calls across `it` blocks in one file accumulate
// DOM nodes and break role/label queries in later tests.
afterEach(() => {
  cleanup();
});
