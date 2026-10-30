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

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const COMPILED_RULES = RULES.map(rule => ({
  folder: rule.folder,
  patterns: rule.keywords.map(keyword => {
    const escaped = normalize(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`);
  }),
}));

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

  // Completed scan-cache entries retain only compact metadata, not page bodies.
  return `${pageTitle.slice(0, 1000)} ${pageDesc.slice(0, 1000)}`.toLowerCase();
}

/**
 * Classifies a bookmark into a suggested folder based on its title,
 * URL, and page metadata. Uses a single manual fallback for uncertain classifications.
 */
export function classifyDecision(
  title: string,
  url: string,
  pageMetadata: string,
): { folder: string; confidence: 'high' | 'medium' | 'low'; reason: string } {
  let hostname = '';
  let pathname = '';
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    pathname = decodeURIComponent(parsed.pathname);
  } catch { /* Titles can still be classified without a valid URL. */ }
  const text = normalize(`${title} ${hostname} ${pathname} ${pageMetadata}`);
  let winner: string | undefined;
  let bestScore = 0;
  let tied = false;
  for (const rule of COMPILED_RULES) {
    const score = rule.patterns.filter(pattern => pattern.test(text)).length;
    if (score > bestScore) { bestScore = score; winner = rule.folder; tied = false; }
    else if (score > 0 && score === bestScore) tied = true;
  }
  if (winner) return { folder: winner, confidence: tied ? 'low' : bestScore >= 2 ? 'high' : 'medium', reason: tied ? 'Coincidencias en varias categorías; requiere revisión.' : `${bestScore} reglas coinciden con título, dominio, ruta o metadatos.` };

  // A folder for every unrecognized domain makes the library noisier.
  return { folder: '📁 Varios', confidence: 'low', reason: 'No hay evidencia suficiente para una categoría.' };
}

export function classifyBookmark(title: string, url: string, metadata: string): string {
  return classifyDecision(title, url, metadata).folder;
}
