import { describe, it, expect } from 'vitest';
import { classifyBookmark, extractMetadata } from './classifier';

describe('classifyBookmark', () => {
  it('matches a keyword in the title', () => {
    expect(classifyBookmark('GitHub - my repo', 'https://github.com/foo/bar', '')).toBe(
      '💻 Desarrollo',
    );
  });

  it('matches a keyword found only in the URL', () => {
    expect(classifyBookmark('My cool project', 'https://github.com/foo/bar', '')).toBe(
      '💻 Desarrollo',
    );
  });

  it('matches a keyword found only in page metadata', () => {
    expect(
      classifyBookmark('Untitled', 'https://example.com/page', 'aprender a cocinar con udemy'),
    ).toBe('📚 Lectura y Educación');
  });

  it('uses one manual fallback instead of creating a folder per unknown domain', () => {
    expect(classifyBookmark('', 'https://coolsite.io/page', '')).toBe('📁 Varios');
  });

  it('falls back to "Varios" for generic subdomains', () => {
    expect(classifyBookmark('', 'https://docs.somethingelse.com', '')).toBe('📁 Varios');
  });

  it('falls back to "Varios" for a malformed URL', () => {
    expect(classifyBookmark('Something', 'not-a-valid-url', '')).toBe('📁 Varios');
  });
});

describe('extractMetadata', () => {
  it('extracts title and meta description, lowercased', () => {
    const html = `
      <html><head>
        <title>My Page</title>
        <meta name="description" content="A Great Page">
      </head></html>
    `;
    expect(extractMetadata(html)).toBe('my page a great page');
  });

  it('falls back to og:description when name=description is absent', () => {
    const html = `
      <html><head>
        <title>My Page</title>
        <meta property="og:description" content="OG Summary">
      </head></html>
    `;
    expect(extractMetadata(html)).toBe('my page og summary');
  });

  it('returns a blank-ish string when neither tag is present', () => {
    expect(extractMetadata('<html><body>no head tags here</body></html>')).toBe(' ');
  });
});

it('does not match keywords embedded in unrelated words or URL queries', () => {
  expect(classifyBookmark('Transaction', 'https://example.com/?next=github', '')).toBe('📁 Varios');
  expect(classifyBookmark('Reaction', 'https://example.com', '')).toBe('📁 Varios');
});
it('weighs multiple relevant words instead of taking the first matching category', () => {
  expect(classifyBookmark('AWS hosting deploy tutorial', 'https://example.com', '')).toBe('☁️ Cloud y Servicios');
});

it('bounds retained metadata for large libraries', () => {
  const html = `<title>${'a'.repeat(20_000)}</title><meta name="description" content="${'b'.repeat(20_000)}">`;
  expect(extractMetadata(html)).toHaveLength(2001);
});
