'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/provide-chatbot-advisory.ts';
import '@/ai/flows/analyze-crop-image-for-disease.ts';
import '@/ai/flows/analyze-fruit-image-for-disease.ts';
import '@/ai/flows/integrate-weather-data-for-advisory.ts';
import '@/ai/flows/get-market-prices.ts';
import '@/ai/flows/get-kheti-samachar.ts';
import '@/ai/flows/simulate-crop-profitability.ts';
