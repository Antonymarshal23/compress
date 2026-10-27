var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
function sitemapPlugin(baseUrl) {
    var registryPath = resolve(process.cwd(), 'src/data/tool-registry.json');
    var registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    var publishedTools = registry.filter(function (tool) { return tool.status === 'available'; });
    var categorySlugs = Array.from(new Map(publishedTools.map(function (tool) { return [
        tool.category.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        tool.category,
    ]; })).keys());
    var staticPaths = [
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
    var publicPaths = __spreadArray(__spreadArray(__spreadArray([], staticPaths, true), categorySlugs.map(function (slug) { return "/categories/".concat(slug); }), true), publishedTools.map(function (_a) {
        var slug = _a.slug;
        return "/tools/".concat(slug);
    }), true);
    return {
        name: 'paperpilot-public-seo-files',
        generateBundle: function () {
            var locations = publicPaths
                .map(function (path) { return "  <url><loc>".concat(baseUrl).concat(path, "</loc></url>"); })
                .join('\n');
            this.emitFile({
                type: 'asset',
                fileName: 'sitemap.xml',
                source: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n".concat(locations, "\n</urlset>\n"),
            });
            this.emitFile({
                type: 'asset',
                fileName: 'robots.txt',
                source: "User-agent: *\nAllow: /\nSitemap: ".concat(baseUrl, "/sitemap.xml\n"),
            });
        },
    };
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var envDir = resolve(process.cwd(), '../..');
    var env = loadEnv(mode, envDir, 'VITE_');
    var baseUrl = (env.VITE_PUBLIC_BASE_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
    return {
        envDir: envDir,
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
