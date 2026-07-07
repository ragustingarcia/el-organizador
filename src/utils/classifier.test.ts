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

  it('falls back to the capitalized domain when no rule matches', () => {
    expect(classifyBookmark('', 'https://coolsite.io/page', '')).toBe('📁 Coolsite');
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
