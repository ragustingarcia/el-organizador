import { describe, it, expect } from 'vitest';
import { isUrlSafe } from './url-guard';

describe('isUrlSafe', () => {
  it('allows plain http/https URLs', () => {
    expect(isUrlSafe('https://example.com')).toBe(true);
    expect(isUrlSafe('http://example.com/page')).toBe(true);
  });

  it('blocks dangerous schemes', () => {
    expect(isUrlSafe('file:///etc/passwd')).toBe(false);
    expect(isUrlSafe('chrome://extensions')).toBe(false);
    expect(isUrlSafe('chrome-extension://abc123/page.html')).toBe(false);
    expect(isUrlSafe('javascript:alert(1)')).toBe(false);
    expect(isUrlSafe('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('blocks non-http(s) schemes not explicitly listed either', () => {
    expect(isUrlSafe('ftp://example.com')).toBe(false);
  });

  it('blocks localhost and loopback', () => {
    expect(isUrlSafe('http://localhost:3000')).toBe(false);
    expect(isUrlSafe('http://127.0.0.1/admin')).toBe(false);
  });

  it('blocks RFC1918 private IP ranges', () => {
    expect(isUrlSafe('http://10.0.0.5')).toBe(false);
    expect(isUrlSafe('http://192.168.1.1')).toBe(false);
    expect(isUrlSafe('http://172.16.0.1')).toBe(false);
    expect(isUrlSafe('http://172.31.255.255')).toBe(false);
  });

  it('does not block a public IP that merely looks similar to a private range', () => {
    // 172.32.0.0 is outside the RFC1918 172.16.0.0–172.31.255.255 block.
    expect(isUrlSafe('http://172.32.0.1')).toBe(true);
  });

  it('rejects malformed URLs instead of throwing', () => {
    expect(isUrlSafe('not a url')).toBe(false);
  });
});
