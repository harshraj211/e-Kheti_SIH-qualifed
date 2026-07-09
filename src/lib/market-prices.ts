import { z } from 'zod';

const MarketPriceSchema = z.object({
  cropName: z.string(),
  variety: z.string(),
  market: z.string(),
  minPrice: z.number(),
  maxPrice: z.number(),
  modalPrice: z.number(),
  arrivalDate: z.string(),
});

export const GetMarketPricesOutputSchema = z.object({
  prices: z.array(MarketPriceSchema),
});

export type GetMarketPricesOutput = z.infer<typeof GetMarketPricesOutputSchema>;

export async function fetchMarketPricesFromApi(input: { location: string; crop: string }): Promise<GetMarketPricesOutput> {
  const apiKey =
    process.env.AGMARKNET_API_KEY ||
    process.env.DATA_GOV_API_KEY ||
    process.env.NEXT_PUBLIC_DATA_GOV_API_KEY;

  if (!apiKey) {
    throw new Error('Market price API key is not configured.');
  }

  const url = new URL('https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070');
  url.searchParams.append('api-key', apiKey);
  url.searchParams.append('format', 'json');
  url.searchParams.append('limit', '500');
  url.searchParams.append('offset', '0');

  if (input.location) {
    url.searchParams.append('filters[state]', input.location);
  }
  if (input.crop && input.crop.toLowerCase() !== 'all') {
    url.searchParams.append('filters[commodity]', input.crop);
  }

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (!data.records || !Array.isArray(data.records)) {
    return { prices: [] };
  }

  const prices = data.records
    .map((record: any) => ({
      cropName: record.commodity,
      variety: record.variety,
      market: record.market,
      minPrice: Number(record.min_price),
      maxPrice: Number(record.max_price),
      modalPrice: Number(record.modal_price),
      arrivalDate: record.arrival_date,
    }))
    .filter((price: { modalPrice: number }) => !Number.isNaN(price.modalPrice) && price.modalPrice > 0);

  return GetMarketPricesOutputSchema.parse({ prices });
}
