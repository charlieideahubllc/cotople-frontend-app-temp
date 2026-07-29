import { describe, it, expect } from "vitest";
import { isSafeRedirectPath, resolveSafeRedirect } from "./safe-redirect";

// Requirement: AUTH-0003 AC1 — open-redirect prevention on the post-login
// ?next= param (PR #5 review finding: CWE-601, tab/newline stripping bypass)
describe("isSafeRedirectPath", () => {
  it("accepts a plain relative path", () => {
    expect(isSafeRedirectPath("/events")).toBe(true);
    expect(isSafeRedirectPath("/events/123")).toBe(true);
    expect(isSafeRedirectPath("/")).toBe(true);
  });

  it("accepts a relative path with a query string or hash", () => {
    expect(isSafeRedirectPath("/events?tab=archived")).toBe(true);
    expect(isSafeRedirectPath("/events#section")).toBe(true);
  });

  it("rejects null, undefined, and empty string", () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
  });

  it("rejects a path that does not start with /", () => {
    expect(isSafeRedirectPath("evil.com")).toBe(false);
    expect(isSafeRedirectPath("events")).toBe(false);
  });

  it("rejects an absolute URL to another origin", () => {
    expect(isSafeRedirectPath("https://evil.com")).toBe(false);
    expect(isSafeRedirectPath("http://evil.com/path")).toBe(false);
  });

  it("rejects a literal protocol-relative path", () => {
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
  });

  it("rejects a tab-obfuscated protocol-relative path (verified bypass)", () => {
    // Decoded from a real attacker query string: /login?next=%2F%09%2Fevil.com
    expect(isSafeRedirectPath("/\t/evil.com")).toBe(false);
  });

  it("rejects newline- and carriage-return-obfuscated protocol-relative paths", () => {
    expect(isSafeRedirectPath("/\n/evil.com")).toBe(false);
    expect(isSafeRedirectPath("/\r/evil.com")).toBe(false);
  });

  it("rejects a backslash-obfuscated protocol-relative path", () => {
    // The WHATWG URL spec treats "\" as equivalent to "/" in http(s) URLs,
    // so "/\evil.com" resolves the same as "//evil.com" — another known
    // open-redirect bypass technique, correctly caught by origin comparison.
    expect(isSafeRedirectPath("/\\evil.com")).toBe(false);
  });
});

describe("resolveSafeRedirect", () => {
  it("returns the path when safe", () => {
    expect(resolveSafeRedirect("/events", "/")).toBe("/events");
  });

  it("returns the fallback when the path is unsafe", () => {
    expect(resolveSafeRedirect("/\t/evil.com", "/")).toBe("/");
    expect(resolveSafeRedirect("//evil.com", "/")).toBe("/");
    expect(resolveSafeRedirect(null, "/")).toBe("/");
  });
});
