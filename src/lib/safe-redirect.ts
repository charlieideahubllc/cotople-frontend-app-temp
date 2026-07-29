// Requirement: AUTH-0003 AC1 (post-login redirect target from proxy.ts's ?next= param)
// Only allow relative, same-origin paths.
//
// Do NOT validate this with string prefix checks (e.g. rejecting only
// literal "//" or "\\" prefixes). Browsers and Next.js's router strip
// control characters (tab, newline, CR) from a URL during resolution per
// the WHATWG URL spec, so a string that doesn't *look* protocol-relative
// as raw text (e.g. "/\t/evil.com") can still resolve off-origin once
// actually navigated to. Resolving through the real URL parser and
// comparing origins is the only way to match what the browser will
// actually do with the string.
const SAFE_REDIRECT_BASE = "http://localhost";

export function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (typeof path !== "string" || !path.startsWith("/")) {
    return false;
  }
  try {
    const resolved = new URL(path, SAFE_REDIRECT_BASE);
    return resolved.origin === SAFE_REDIRECT_BASE;
  } catch {
    return false;
  }
}

export function resolveSafeRedirect(
  path: string | null | undefined,
  fallback: string,
): string {
  return isSafeRedirectPath(path) ? path : fallback;
}
