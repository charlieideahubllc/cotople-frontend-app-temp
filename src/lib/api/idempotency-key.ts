// Requirements: CAP-0005 AC1
// One key per capture submission attempt (SRS §9.4), so a network retry of
// the same attempt doesn't create a second occurrence. Callers own the
// "same attempt vs. new attempt" distinction — see ManualCaptureForm.
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
