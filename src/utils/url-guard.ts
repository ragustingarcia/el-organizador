/** Syntactic guard only: a public hostname can still resolve to a private IP. */
export function isUrlSafe(value: string): boolean {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') && !host.startsWith('[')) return false;
    if (['localhost', 'local', 'internal', 'lan', 'home', 'test', 'invalid'].some(
      suffix => host === suffix || host.endsWith(`.${suffix}`),
    )) return false;
    if (host.startsWith('[')) {
      // Only global unicast literals, excluding mapped IPv4 and common tunnels.
      return /^\[[23][0-9a-f]{3}:/.test(host) &&
        !/^\[(2001:(db8|0|10|20):|2002:)/.test(host);
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || b === 0)) ||
        (a === 198 && (b === 18 || b === 19))) return false;
    }
    return true;
  } catch { return false; }
}
