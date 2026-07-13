export const DISEASE_CONTEXT_STORAGE_KEY = 'ekheti-pending-disease-context-v1';

export type DiseaseChatContext = {
  itemType: 'Crop' | 'Fruit';
  diseaseDetected: boolean;
  diseaseName: string;
  confidenceLevel: number;
  suggestedSolutions: string;
  createdAt: string;
};

export function saveDiseaseChatContext(context: DiseaseChatContext) {
  window.sessionStorage.setItem(DISEASE_CONTEXT_STORAGE_KEY, JSON.stringify(context));
}

export function consumeDiseaseChatContext(): DiseaseChatContext | null {
  try {
    const stored = window.sessionStorage.getItem(DISEASE_CONTEXT_STORAGE_KEY);
    if (!stored) return null;
    window.sessionStorage.removeItem(DISEASE_CONTEXT_STORAGE_KEY);
    return JSON.parse(stored) as DiseaseChatContext;
  } catch {
    return null;
  }
}

export function diseaseContextToText(context: DiseaseChatContext) {
  return [
    'Disease detector result supplied by eKheti:',
    `Item type: ${context.itemType}`,
    `Disease detected: ${context.diseaseDetected ? 'yes' : 'no'}`,
    `Prediction: ${context.diseaseName}`,
    `Model confidence: ${Math.round(context.confidenceLevel * 100)}%`,
    `Initial model guidance: ${context.suggestedSolutions}`,
    'Treat this as a model prediction, not a confirmed laboratory diagnosis.',
  ].join('\n');
}
