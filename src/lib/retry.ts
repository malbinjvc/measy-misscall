/**
 * Simple retry with exponential backoff for external API calls.
 * Used for Twilio, Resend, ElevenLabs — transient failures only.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, label = "operation" } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      // Don't retry on client errors (4xx) — only transient/server errors
      if (isNonRetryable(error)) throw error;

      if (attempt === maxAttempts) {
        console.error(`[retry] ${label} failed after ${maxAttempts} attempts`);
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 500, 1000, 2000...
      console.warn(`[retry] ${label} attempt ${attempt} failed, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  // Unreachable but satisfies TS
  throw new Error(`${label} failed`);
}

function isNonRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  // Twilio errors: status 400-499 (except 429) are non-retryable
  const status = (error as { status?: number }).status;
  if (typeof status === "number" && status >= 400 && status < 500 && status !== 429) {
    return true;
  }
  // HTTP response status codes
  const code = (error as { code?: number | string }).code;
  if (code === "INVALID_PARAMETER" || code === "ENOTFOUND") return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
