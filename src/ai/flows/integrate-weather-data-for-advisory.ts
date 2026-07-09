'use server';

/**
 * @fileOverview Integrates weather data into the advisory for farmers using the local AI service.
 */

import { getLocalWeatherAdvisory } from '@/lib/local-ai-client';
import { getCurrentWeather } from '@/services/weather';
import { z } from 'zod';

const IntegrateWeatherDataForAdvisoryInputSchema = z.object({
  cropType: z.string().describe('The type of crop.'),
  soilDetails: z.string().describe('Details about the soil.'),
  currentStageOfCrop: z.string().describe('The current stage of the crop.'),
  location: z.string().describe('The location of the farm.'),
  advisory: z.string().describe('The base advisory before weather integration.'),
  language: z.string().optional().describe("The language for the response (e.g., 'en', 'hi')."),
});
export type IntegrateWeatherDataForAdvisoryInput = z.infer<typeof IntegrateWeatherDataForAdvisoryInputSchema>;

const WeatherDataSchema = z.object({
  temperature: z.number().describe('The current temperature in Celsius.'),
  condition: z.string().describe('The current weather condition (e.g., sunny, rainy).'),
  humidity: z.number().describe('The current humidity percentage.'),
  windSpeed: z.number().describe('The current wind speed in km/h'),
});

const IntegrateWeatherDataForAdvisoryOutputSchema = z.object({
  integratedAdvisory: z.string().describe('The advisory integrated with weather data.'),
  weather: WeatherDataSchema.optional().describe('The weather data used for the advisory.'),
});
export type IntegrateWeatherDataForAdvisoryOutput = z.infer<typeof IntegrateWeatherDataForAdvisoryOutputSchema>;

export async function integrateWeatherDataForAdvisory(
  input: IntegrateWeatherDataForAdvisoryInput
): Promise<IntegrateWeatherDataForAdvisoryOutput> {
  return integrateWeatherDataForAdvisoryFlow(input);
}

async function integrateWeatherDataForAdvisoryFlow(
  input: IntegrateWeatherDataForAdvisoryInput
): Promise<IntegrateWeatherDataForAdvisoryOutput> {
  let weatherData: z.infer<typeof WeatherDataSchema> | undefined;
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;

  if (apiKey) {
    try {
      weatherData = await getCurrentWeather(input.location, apiKey);
    } catch (error) {
      console.error('Failed to fetch weather in flow:', error);
    }
  } else {
    console.warn('OPENWEATHERMAP_API_KEY is not configured. Skipping weather fetch.');
  }

  const output = await getLocalWeatherAdvisory({ ...input, weather: weatherData });

  return IntegrateWeatherDataForAdvisoryOutputSchema.parse({
    integratedAdvisory: output.integratedAdvisory,
    weather: weatherData,
  });
}
