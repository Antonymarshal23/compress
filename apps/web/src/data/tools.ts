import toolRegistry from './tool-registry.json';

export type ToolStatus = 'available' | 'planned' | 'beta';

export type ToolDefinition = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  status: ToolStatus;
  icon: string;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
};

export const tools = toolRegistry as ToolDefinition[];

export const publishedTools = tools.filter((tool) => tool.status === 'available');

export function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const publishedCategories = Array.from(
  new Map(publishedTools.map((tool) => [categorySlug(tool.category), tool.category])),
  ([slug, name]) => ({ slug, name }),
);
