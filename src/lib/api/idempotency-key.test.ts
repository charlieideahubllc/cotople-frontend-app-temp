import { describe, it, expect } from "vitest";
import { generateIdempotencyKey } from "./idempotency-key";

// Requirement: CAP-0005 AC1
describe("generateIdempotencyKey", () => {
  it("returns a string", () => {
    expect(typeof generateIdempotencyKey()).toBe("string");
  });

  it("returns a different value on each call", () => {
    const a = generateIdempotencyKey();
    const b = generateIdempotencyKey();
    expect(a).not.toBe(b);
  });
});
