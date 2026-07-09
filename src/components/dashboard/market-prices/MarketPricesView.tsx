
'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/hooks/useTranslation';
import { cropData } from '@/lib/item-data';
import type { GetMarketPricesOutput } from '@/lib/market-prices';

type MarketPrice = GetMarketPricesOutput['prices'][0];

// Helper to parse dd/mm/yyyy dates
const parseDate = (dateString: string) => {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      // parts[1] - 1 because months are 0-indexed in JS
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    return new Date(dateString); // fallback
};


export function MarketPricesView() {
  const [location, setLocation] = useState('Punjab');
  const [crop, setCrop] = useState('All');
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const popularCrops = useMemo(() => {
    const cropNames = Object.values(cropData).map(c => c.name);
    return ["All", ...cropNames.sort()];
  }, []);

  const fetchPrices = () => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/market-prices?location=${encodeURIComponent(location)}&crop=${encodeURIComponent(crop)}`, {
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to fetch market prices.');
        }
        const result = payload as GetMarketPricesOutput;
        const sortedPrices = result.prices.sort((a,b) => parseDate(b.arrivalDate).getTime() - parseDate(a.arrivalDate).getTime());
        setPrices(sortedPrices);
      } catch (e) {
        console.error(e);
        setError('Failed to fetch market prices. The external API might be temporarily unavailable or your filter combination returned no results. Please try again later or adjust your search.');
        setPrices([]);
      }
    });
  };

  // Fetch prices on initial load
  useEffect(() => {
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPrices();
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('marketPricesPage.search.title')}</CardTitle>
          <CardDescription>{t('marketPricesPage.search.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-2 md:col-span-1">
              <label htmlFor="location" className="block text-sm font-medium mb-1">{t('marketPricesPage.search.locationLabel')}</label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('marketPricesPage.search.locationPlaceholder')}
                disabled={isPending}
              />
            </div>
            <div>
              <label htmlFor="crop" className="block text-sm font-medium mb-1">{t('marketPricesPage.search.cropLabel')}</label>
               <Select onValueChange={setCrop} defaultValue={crop} disabled={isPending}>
                  <SelectTrigger id="crop">
                    <SelectValue placeholder={t('marketPricesPage.search.cropPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {popularCrops.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {t('marketPricesPage.search.button')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>{t('marketPricesPage.results.title', { crop: crop === 'All' ? 'All Crops' : crop, location })}</CardTitle>
            <CardDescription>{t('marketPricesPage.results.description')}</CardDescription>
        </CardHeader>
        <CardContent>
            {isPending ? (
                 <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertTitle>{t('marketPricesPage.results.errorTitle')}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : prices.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                    <p className="text-muted-foreground">{t('marketPricesPage.results.noResults')}</p>
                </div>
            ) : (
              <ScrollArea className="h-[50vh]">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                        <TableHead>{t('marketPricesPage.results.cropVariety')}</TableHead>
                        <TableHead>{t('marketPricesPage.results.market')}</TableHead>
                        <TableHead>{t('marketPricesPage.results.arrivalDate')}</TableHead>
                        <TableHead className="text-right">{t('marketPricesPage.results.minPrice')}</TableHead>
                        <TableHead className="text-right">{t('marketPricesPage.results.maxPrice')}</TableHead>
                        <TableHead className="text-right font-semibold">{t('marketPricesPage.results.modalPrice')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {prices.map((price, index) => (
                        <TableRow key={`${price.market}-${price.cropName}-${price.arrivalDate}-${index}`}>
                            <TableCell>
                                <p className="font-medium">{price.cropName}</p>
                                <p className="text-xs text-muted-foreground">{price.variety}</p>
                            </TableCell>
                            <TableCell>{price.market}</TableCell>
                            <TableCell>{price.arrivalDate}</TableCell>
                            <TableCell className="text-right text-red-600">₹{price.minPrice.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-green-600">₹{price.maxPrice.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-semibold">₹{price.modalPrice.toLocaleString()}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </ScrollArea>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
