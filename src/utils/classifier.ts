// src/utils/classifier.ts

/**
 * Generic classification rules. Keywords are matched against the
 * combined text of the bookmark title, URL, and page metadata.
 *
 * IMPORTANT: Do not add personal/company-specific keywords here.
 * This ships to all users via the Chrome Web Store.
 */
const RULES: { folder: string; keywords: string[] }[] = [
  {
    folder: '💻 Desarrollo',
    keywords: [
      'github', 'gitlab', 'bitbucket', 'stackoverflow', 'stackexchange',
      'npm', 'pypi', 'crates.io', 'developer', 'programming',
      'api docs', 'documentation', 'react', 'angular', 'vue', 'svelte',
      'python', 'javascript', 'typescript', 'rust', 'docker', 'kubernetes',
      'codepen', 'codesandbox', 'replit', 'devtools', 'vscode',
    ],
  },
  {
    folder: '🎨 Diseño',
    keywords: [
      'figma', 'canva', 'dribbble', 'behance', 'sketch', 'adobe',
      'design', 'ui/ux', 'prototype', 'mockup', 'icon', 'font',
      'typography', 'color palette', 'illustration', 'wireframe',
    ],
  },
  {
    folder: '📚 Lectura y Educación',
    keywords: [
      'course', 'curso', 'tutorial', 'learn', 'aprender', 'udemy',
      'coursera', 'edx', 'khan academy', 'wikipedia', 'medium',
      'blog', 'article', 'artículo', 'guide', 'guía', 'ebook',
    ],
  },
  {
    folder: '🛠️ Herramientas',
    keywords: [
      'converter', 'compress', 'editor', 'online tool', 'calculator',
      'generator', 'formatter', 'minifier', 'regex', 'json',
      'pdf tool', 'image resize', 'file convert',
    ],
  },
  {
    folder: '📰 Noticias y Medios',
    keywords: [
      'news', 'noticias', 'bbc', 'cnn', 'reuters', 'podcast',
      'magazine', 'journal', 'diario', 'periódico',
    ],
  },
  {
    folder: '🛒 Compras',
    keywords: [
      'amazon', 'ebay', 'mercadolibre', 'aliexpress', 'shop', 'store',
      'tienda', 'buy', 'comprar', 'price', 'precio', 'deal', 'offer',
    ],
  },
  {
    folder: '🎬 Entretenimiento',
    keywords: [
      'youtube', 'netflix', 'spotify', 'twitch', 'disney+', 'hbo',
      'reddit', 'movie', 'película', 'music', 'música', 'game',
      'juego', 'stream', 'podcast', 'imdb',
    ],
  },
  {
    folder: '💼 Trabajo',
    keywords: [
      'sharepoint', 'confluence', 'jira', 'asana', 'trello', 'slack',
      'teams', 'notion', 'monday', 'project management', 'dashboard',
      'report', 'reporte', 'crm', 'salesforce', 'hubspot',
    ],
  },
  {
    folder: '☁️ Cloud y Servicios',
    keywords: [
      'aws', 'azure', 'gcloud', 'firebase', 'vercel', 'netlify',
      'heroku', 'supabase', 'digitalocean', 'cloudflare',
      'hosting', 'deploy', 'ci/cd',
    ],
  },
  {
    folder: '📱 Social',
    keywords: [
      'twitter', 'x.com', 'facebook', 'instagram', 'linkedin',
      'tiktok', 'threads', 'mastodon', 'bluesky',
    ],
  },
  {
    folder: '💰 Finanzas',
    keywords: [
      'bank', 'banco', 'finance', 'finanzas', 'invest', 'inversión',
      'crypto', 'trading', 'stock', 'bolsa', 'wallet', 'payment',
    ],
  },
];

/**
 * Extracts <title> and <meta description> from raw HTML.
 * Returns a lowercase string combining both.
 */
export function extractMetadata(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);

  const pageTitle = titleMatch?.[1] ?? '';
  const pageDesc = descMatch?.[1] ?? '';

  return `${pageTitle} ${pageDesc}`.toLowerCase();
}

/**
 * Classifies a bookmark into a suggested folder based on its title,
 * URL, and page metadata. Returns null only if truly unclassifiable.
 */
export function classifyBookmark(
  title: string,
  url: string,
  pageMetadata: string,
): string {
  const text = `${title} ${url} ${pageMetadata}`.toLowerCase();

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return rule.folder;
    }
  }

  // Fallback: capitalize the main domain name as folder
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const domain = hostname.split('.')[0];
    // Skip generic subdomains
    if (domain && domain.length > 2 && !['app', 'docs', 'drive', 'mail', 'web'].includes(domain)) {
      return `📁 ${domain.charAt(0).toUpperCase() + domain.slice(1)}`;
    }
  } catch {
    // malformed URL
  }

  return '📁 Varios';
}
