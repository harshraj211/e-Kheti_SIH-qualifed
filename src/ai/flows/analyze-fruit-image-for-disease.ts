'use server';
/**
 * @fileOverview Analyzes a fruit image for potential diseases.
 *
 * - analyzeFruitImageForDisease - A function that handles the fruit image analysis process.
 * - AnalyzeFruitImageForDiseaseInput - The input type for the analyzeFruitImageForDisease function.
 * - AnalyzeFruitImageForDiseaseOutput - The return type for the analyzeFruitImageForDisease function.
 */

import { analyzeLocalDiseaseImage } from '@/lib/local-ai-client';
import {z} from 'zod';

const AnalyzeFruitImageForDiseaseInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of the fruit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  language: z.string().optional().describe("The language for the response (e.g., 'en', 'hi')."),
});
export type AnalyzeFruitImageForDiseaseInput = z.infer<typeof AnalyzeFruitImageForDiseaseInputSchema>;

const AnalyzeFruitImageForDiseaseOutputSchema = z.object({
  diseaseDetected: z.boolean().describe('Whether a disease is detected in the fruit image.'),
  diseaseName: z.string().describe('The name of the detected disease, if any.'),
  confidenceLevel: z
    .number()
    .describe('The confidence level of the disease detection (0-1).'),
  suggestedSolutions: z
    .string()
    .describe('Suggested solutions to address the detected disease.'),
});
export type AnalyzeFruitImageForDiseaseOutput = z.infer<typeof AnalyzeFruitImageForDiseaseOutputSchema>;

export async function analyzeFruitImageForDisease(
  input: AnalyzeFruitImageForDiseaseInput
): Promise<AnalyzeFruitImageForDiseaseOutput> {
  return analyzeFruitImageForDiseaseFlow(input);
}

async function analyzeFruitImageForDiseaseFlow(
  input: AnalyzeFruitImageForDiseaseInput
): Promise<AnalyzeFruitImageForDiseaseOutput> {
  const output = await analyzeLocalDiseaseImage({
    photoDataUri: input.photoDataUri,
    itemType: 'Fruit',
    language: input.language,
  });

  return AnalyzeFruitImageForDiseaseOutputSchema.parse(output);
}
