const LOCAL_AI_BASE_URL = process.env.LOCAL_AI_BASE_URL || 'http://127.0.0.1:8000';
import type { FarmProfile } from '@/lib/farm-profile';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${LOCAL_AI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Local AI service failed (${response.status}): ${message}`);
  }

  return response.json() as Promise<T>;
}

export type LocalChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type LocalChatResponse = {
  advice: string;
};

export function getLocalChatAdvice(input: {
  query: string;
  managementType: 'Crops' | 'Fruits';
  history?: LocalChatMessage[];
  documentContent?: string;
  language?: string;
  location?: string;
  farmProfile?: FarmProfile;
}) {
  return postJson<LocalChatResponse>('/chat', input);
}

export type LocalDiseaseResponse = {
  diseaseDetected: boolean;
  diseaseName: string;
  confidenceLevel: number;
  suggestedSolutions: string;
};

export function analyzeLocalDiseaseImage(input: {
  photoDataUri: string;
  itemType: 'Crop' | 'Fruit';
  language?: string;
}) {
  return postJson<LocalDiseaseResponse>('/disease', input);
}

export function getLocalWeatherAdvisory(input: {
  cropType: string;
  soilDetails: string;
  currentStageOfCrop: string;
  location: string;
  advisory: string;
  language?: string;
  weather?: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
  };
}) {
  return postJson<{ integratedAdvisory: string }>('/advisory', input);
}
