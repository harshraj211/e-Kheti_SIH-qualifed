
'use server';
/**
 * @fileOverview Fetches market prices for crops.
 *
 * - getMarketPrices - A function that fetches market prices for a given location and crop.
 * - GetMarketPricesInput - The input type for the getMarketPrices function.
 * - GetMarketPricesOutput - The return type for the getMarketprices function.
 */

import {z} from 'zod';
import { fetchMarketPricesFromApi } from '@/lib/market-prices';

const GetMarketPricesInputSchema = z.object({
  location: z.string().describe('The location (e.g., state or district) to fetch market prices for.'),
  crop: z.string().describe('The specific crop to fetch prices for.'),
});
export type GetMarketPricesInput = z.infer<typeof GetMarketPricesInputSchema>;

const MarketPriceSchema = z.object({
    cropName: z.string().describe('The name of the crop.'),
    variety: z.string().describe('The variety of the crop.'),
    market: z.string().describe('The name of the market (mandi).'),
    minPrice: z.number().describe('The minimum price per quintal.'),
    maxPrice: z.number().describe('The maximum price per quintal.'),
    modalPrice: z.number().describe('The most common price per quintal.'),
    arrivalDate: z.string().describe('The date of price recording.'),
});

const GetMarketPricesOutputSchema = z.object({
  prices: z.array(MarketPriceSchema).describe('A list of market prices for the specified crop and location.'),
});
export type GetMarketPricesOutput = z.infer<typeof GetMarketPricesOutputSchema>;

export async function getMarketPrices(input: GetMarketPricesInput): Promise<GetMarketPricesOutput> {
    const parsedInput = GetMarketPricesInputSchema.parse(input);
    try {
      return await fetchMarketPricesFromApi(parsedInput);
    } catch (error) {
      console.error("Error fetching or parsing market prices:", error);
      throw new Error("Failed to fetch market prices from the API.");
    }
}
