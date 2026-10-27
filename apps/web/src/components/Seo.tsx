import { useEffect } from 'react';

type SeoProps = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function Seo({ title, description, path, noindex = false }: SeoProps) {
  useEffect(() => {
    const configuredBaseUrl = import.meta.env.VITE_PUBLIC_BASE_URL?.trim();
    const baseUrl = (configuredBaseUrl || window.location.origin).replace(/\/+$/, '');
    const canonicalUrl = new URL(path, `${baseUrl}/`).toString();

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex,follow' : 'index,follow');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'PaperPilot');
    upsertMeta('property', 'og:url', canonicalUrl);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const schemaId = 'paperpilot-structured-data';
    let schema = document.head.querySelector<HTMLScriptElement>(`script#${schemaId}`);
    if (!schema) {
      schema = document.createElement('script');
      schema.id = schemaId;
      schema.type = 'application/ld+json';
      document.head.appendChild(schema);
    }

    const structuredData = path === '/'
      ? {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'PaperPilot',
          url: baseUrl,
          description,
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: title.replace(/\s*\|\s*PaperPilot$/, ''), item: canonicalUrl },
          ],
        };
    schema.textContent = JSON.stringify(structuredData);
  }, [description, noindex, path, title]);

  return null;
}
