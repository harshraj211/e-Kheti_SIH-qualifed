
'use server';
/**
 * @fileOverview Fetches agricultural news from the Newsdata.io API.
 *
 * - getKhetiSamachar - Fetches news articles based on language.
 * - GetKhetiSamacharInput - Input schema for the flow.
 * - GetKhetiSamacharOutput - Output schema for the flow.
 */

import { z } from 'zod';

const GetKhetiSamacharInputSchema = z.object({
  language: z.enum(['en', 'hi']).describe('The language for the news articles.'),
});
export type GetKhetiSamacharInput = z.infer<typeof GetKhetiSamacharInputSchema>;

const ArticleSchema = z.object({
    title: z.string().nullable(),
    link: z.string().nullable(),
    description: z.string().nullable(),
    pubDate: z.string().nullable(),
    image_url: z.string().nullable(),
    source_id: z.string().nullable(),
});
export type KhetiSamacharArticle = z.infer<typeof ArticleSchema>;

const GetKhetiSamacharOutputSchema = z.object({
  articles: z.array(ArticleSchema),
});
export type GetKhetiSamacharOutput = z.infer<typeof GetKhetiSamacharOutputSchema>;


export async function getKhetiSamachar(input: GetKhetiSamacharInput): Promise<GetKhetiSamacharOutput> {
    const { language } = GetKhetiSamacharInputSchema.parse(input);
    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) {
      throw new Error("NEWSDATA_API_KEY is not configured in environment variables.");
    }
    
    const url = new URL("https://newsdata.io/api/1/news");
    url.searchParams.append('apikey', apiKey);
    url.searchParams.append('q', 'agriculture OR farming'); // Broaden the query
    url.searchParams.append('country', 'in');
    url.searchParams.append('language', language);
    url.searchParams.append('category', 'business,science,technology,politics');


    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Newsdata.io API request failed:', response.status, errorText);
            throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();

        if (data.status === 'error') {
            console.error('Newsdata.io API error:', data.results.message);
            throw new Error(data.results.message);
        }

        const articles = data.results || [];
        
        return GetKhetiSamacharOutputSchema.parse({
            articles: articles.map((article: any) => ({
                title: article.title,
                link: article.link,
                description: article.description,
                pubDate: article.pubDate,
                image_url: article.image_url,
                source_id: article.source_id,
            })),
        });

    } catch (error) {
        console.error("Error fetching or parsing news:", error);
        throw new Error("Failed to fetch news from the API.");
    }
}
