'use server';

/**
 * @fileOverview Simulates crop yield and profitability without a hosted LLM.
 */

import { z } from 'zod';
import { getCurrentWeather } from '@/services/weather';
import { getMarketPrices } from './get-market-prices';

const SimulateCropProfitabilityInputSchema = z.object({
  landSizeInAcres: z.number(),
  cropName: z.string(),
  inputCosts: z.number(),
  location: z.string().describe("The farmer's location (e.g., city, state)."),
});
export type SimulateCropProfitabilityInput = z.infer<typeof SimulateCropProfitabilityInputSchema>;

const SimulateCropProfitabilityOutputSchema = z.object({
  expectedYieldPerAcre: z.number().describe('Expected yield in kilograms per acre.'),
  estimatedSellingPricePerKg: z.number().describe('Estimated selling price in rupees per kilogram.'),
  totalRevenue: z.number().describe('Calculated as (Yield * Price * Land Size).'),
  netProfit: z.number().describe('Calculated as (Total Revenue - Input Costs).'),
  profitabilityIndicator: z.enum(['High', 'Medium', 'Low']).describe('An indicator of profitability.'),
  recommendation: z.string().describe('A concise recommendation and summary of the simulation.'),
  bestCropChoice: z.string().describe('The crop with the highest simulated profit.'),
  alternativeCropSuggestion: z.string().optional().describe('An alternative crop suggestion if risks are high.'),
});
export type SimulateCropProfitabilityOutput = z.infer<typeof SimulateCropProfitabilityOutputSchema>;

const fallbackYieldKgPerAcre: Record<string, number> = {
  rice: 2600,
  wheat: 1800,
  maize: 2400,
  potato: 9000,
  onion: 6500,
  tomato: 8000,
  cotton: 700,
  sugarcane: 32000,
  soybean: 1000,
  mustard: 800,
};

export async function simulateCropProfitability(
  input: SimulateCropProfitabilityInput
): Promise<SimulateCropProfitabilityOutput> {
  const parsedInput = SimulateCropProfitabilityInputSchema.parse(input);
  const cropKey = parsedInput.cropName.toLowerCase().trim();

  let modalPricesPerQuintal: number[] = [];
  try {
    const market = await getMarketPrices({
      location: parsedInput.location,
      crop: parsedInput.cropName,
    });
    modalPricesPerQuintal = market.prices.map((price) => price.modalPrice).filter((price) => price > 0);
  } catch (error) {
    console.warn('Market price fetch failed; using fallback price.', error);
  }

  let weatherAdjustment = 1;
  try {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
    if (apiKey) {
      const weather = await getCurrentWeather(parsedInput.location, apiKey);
      if (weather.temperature > 38 || weather.temperature < 8) weatherAdjustment -= 0.12;
      if (weather.humidity > 85) weatherAdjustment -= 0.06;
      if (/rain|storm|thunder/i.test(weather.condition)) weatherAdjustment -= 0.05;
    }
  } catch (error) {
    console.warn('Weather fetch failed; using neutral yield adjustment.', error);
  }

  const averageModalPricePerQuintal =
    modalPricesPerQuintal.length > 0
      ? modalPricesPerQuintal.reduce((total, price) => total + price, 0) / modalPricesPerQuintal.length
      : 2200;

  const expectedYieldPerAcre = Math.round((fallbackYieldKgPerAcre[cropKey] || 1800) * weatherAdjustment);
  const estimatedSellingPricePerKg = Number((averageModalPricePerQuintal / 100).toFixed(2));
  const totalRevenue = Math.round(expectedYieldPerAcre * estimatedSellingPricePerKg * parsedInput.landSizeInAcres);
  const netProfit = Math.round(totalRevenue - parsedInput.inputCosts);
  const profitRatio = parsedInput.inputCosts > 0 ? netProfit / parsedInput.inputCosts : 0;
  const profitabilityIndicator = profitRatio > 0.5 ? 'High' : profitRatio >= 0.1 ? 'Medium' : 'Low';
  const alternativeCropSuggestion =
    profitabilityIndicator === 'Low'
      ? 'Try comparing wheat, maize, pulses, or a locally recommended short-duration crop before committing.'
      : undefined;

  return SimulateCropProfitabilityOutputSchema.parse({
    expectedYieldPerAcre,
    estimatedSellingPricePerKg,
    totalRevenue,
    netProfit,
    profitabilityIndicator,
    recommendation:
      `For ${parsedInput.cropName}, estimated yield is ${expectedYieldPerAcre} kg/acre and price is Rs ${estimatedSellingPricePerKg}/kg. ` +
      `Expected net profit is Rs ${netProfit}. Verify with your nearest mandi and local extension officer before buying inputs.`,
    bestCropChoice: parsedInput.cropName,
    alternativeCropSuggestion,
  });
}
