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
export declare const tools: ToolDefinition[];
export declare const publishedTools: ToolDefinition[];
export declare function categorySlug(category: string): string;
export declare const publishedCategories: {
    slug: string;
    name: string;
}[];
