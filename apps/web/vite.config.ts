import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function sitemapPlugin(baseUrl: string) {
  const registryPath = resolve(process.cwd(), 'src/data/tool-registry.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as Array<{
    slug: string;
    category: string;
    status: string;
  }>;
  const publishedTools = registry.filter((tool) => tool.status === 'available');
  const categorySlugs = Array.from(
    new Map(
      publishedTools.map((tool) => [
        tool.category.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        tool.category,
      ]),
    ).keys(),
  );
  const staticPaths = [
    '/',
    '/tools',
    '/categories',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/cookies-and-ads',
    '/faq',
  ];
  const publicPaths = [
    ...staticPaths,
    ...categorySlugs.map((slug) => `/categories/${slug}`),
    ...publishedTools.map(({ slug }) => `/tools/${slug}`),
  ];

  return {
    name: 'paperpilot-public-seo-files',
    generateBundle() {
      const locations = publicPaths
        .map((path) => `  <url><loc>${baseUrl}${path}</loc></url>`)
        .join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations}\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDir = resolve(process.cwd(), '../..');
  const env = loadEnv(mode, envDir, 'VITE_');
  const baseUrl = (env.VITE_PUBLIC_BASE_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');

  return {
    envDir,
    plugins: [react(), sitemapPlugin(baseUrl)],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
