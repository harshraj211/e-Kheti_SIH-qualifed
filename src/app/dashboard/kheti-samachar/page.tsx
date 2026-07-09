
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getKhetiSamachar, type KhetiSamacharArticle } from '@/ai/flows/get-kheti-samachar';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2, ExternalLink, Globe, Newspaper } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function KhetiSamacharPage() {
  const [news, setNews] = useState<KhetiSamacharArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t, language } = useTranslation();

  const fetchNews = async (lang: 'hi' | 'en') => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getKhetiSamachar({ language: lang });
      setNews(result.articles);
    } catch (e) {
      console.error(e);
      setError("Failed to fetch news. Please check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Default to Hindi on initial load as requested
    fetchNews('hi');
  }, []);

  const handleTabChange = (value: string) => {
    const lang = value as 'hi' | 'en';
    fetchNews(lang);
  };

  const renderNewsCards = () => {
    if (news.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-16">
          <Newspaper className="mx-auto h-12 w-12 mb-4" />
          <p>No news articles found for the selected language.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {news.map((article, index) => (
          <Card key={article.link || index} className="flex flex-col">
            <CardHeader>
              {article.image_url && (
                 <div className="aspect-video relative w-full mb-4">
                    <Image
                        src={article.image_url}
                        alt={article.title || 'Agriculture news image'}
                        fill
                        className="object-cover rounded-t-lg"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                 </div>
              )}
              <CardTitle className="text-lg leading-snug">{article.title || 'Untitled article'}</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-2 text-xs pt-1">
                    <Globe className="h-3 w-3"/> <span>{article.source_id || 'Unknown source'}</span>
                    <span className='px-1'>&bull;</span>
                    <span>{article.pubDate ? new Date(article.pubDate).toLocaleDateString() : 'Date unavailable'}</span>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {article.description || 'No description available.'}
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild variant="secondary" className="w-full">
                <a href={article.link || '#'} target="_blank" rel="noopener noreferrer">
                  Read Full Article <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <main>
       <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold">Kheti Samachar</h1>
            <p className="text-muted-foreground">
                The latest agriculture news, schemes, and farming practices from India.
            </p>
        </div>
        <Tabs defaultValue="hi" onValueChange={handleTabChange}>
            <TabsList>
                <TabsTrigger value="hi">हिन्दी</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
            </TabsList>
        </Tabs>
      </div>

       {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        renderNewsCards()
      )}
    </main>
  );
}
