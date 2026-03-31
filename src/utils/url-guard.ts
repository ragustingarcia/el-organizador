// src/utils/url-guard.ts

const BLOCKED_SCHEMES = [
  'file:',
  'chrome:',
  'chrome-extension:',
  'about:',
  'data:',
  'javascript:',
  'blob:',
];

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^169\.254\./,
  /^\[::1\]/,
  /^\[fe80:/i,
  /^\[fc/i,
  /^\[fd/i,
];

const BLOCKED_HOSTS = ['localhost', '[::1]'];

/**
 * Returns true if the URL is safe to fetch — i.e. it's a public
 * http/https URL and not a local/internal resource.
 */
export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (BLOCKED_SCHEMES.includes(parsed.protocol)) return false;
    if (BLOCKED_HOSTS.includes(parsed.hostname)) return false;
    if (PRIVATE_IP_PATTERNS.some((r) => r.test(parsed.hostname))) return false;

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    return true;
  } catch {
    return false;
  }
}
