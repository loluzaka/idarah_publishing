// Security utilities: rate limiting, validation, sanitization, IP extraction.
// Used by API route handlers. No browser dependencies — safe for server-only import.

// ─── Rate limiting (in-memory sliding window) ────────────────────────────────
// NOTE: Works correctly on a persistent server (VPS / Railway).
// On Vercel serverless, each cold-start resets the store — this is acceptable
// for best-effort rate limiting at bookstore scale. For strict limiting, swap
// in @upstash/ratelimit with a Redis store.

interface RLEntry { count: number; resetAt: number }
const rlStore = new Map<string, RLEntry>();
let pruneCount = 0;

function pruneRL() {
  if (++pruneCount < 200) return;
  pruneCount = 0;
  const now = Date.now();
  for (const [k, v] of rlStore) if (v.resetAt <= now) rlStore.delete(k);
}

export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000
): { ok: true } | { ok: false; retryAfter: number } {
  pruneRL();
  const now = Date.now();
  const entry = rlStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rlStore.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const t = email.trim();
  return t.length >= 3 && t.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
}

// Accepts: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, 10-digit mobile starting 6-9
export function validatePhone(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const digits = phone.replace(/[\s\-().+]/g, '');
  return /^(91)?[6-9]\d{9}$/.test(digits) || /^\+91[6-9]\d{9}$/.test(phone.trim());
}

// ─── Sanitization ─────────────────────────────────────────────────────────────

const ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };

/** Trim, clamp length, and escape HTML special characters. Safe for text content. */
export function sanitize(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength).replace(/[&<>"']/g, c => ESCAPE[c] ?? c);
}

/** Trim, strip ALL HTML tags, clamp. For names, addresses, etc. */
export function stripTags(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, maxLength);
}

// ─── Request helpers ──────────────────────────────────────────────────────────

/** Extract the best-guess client IP from a Next.js Request. */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  );
}
