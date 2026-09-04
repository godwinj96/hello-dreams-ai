export type AiOperation =
  | 'chat'
  | 'embedding'
  | 'image'
  | 'speech_to_text'
  | 'extraction';

export type AiProvider = 'openai' | 'gemini' | 'huggingface' | 'ollama';

export interface AiUsageBreakdownItem {
  operation: AiOperation;
  model: string;
  provider: AiProvider;
  tokensUsed: number;
  costUsd: number;
  estimated?: boolean;
}

export interface AiUsageMetadata {
  operation?: AiOperation;
  provider?: AiProvider;
  model?: string;
  estimated?: boolean;
  breakdown?: AiUsageBreakdownItem[];
  [key: string]: unknown;
}

export interface ChatUsageInput {
  operation: 'chat' | 'extraction';
  provider: AiProvider;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimated?: boolean;
}

export interface EmbeddingUsageInput {
  provider: AiProvider;
  model: string;
  promptTokens: number;
  totalTokens: number;
}

export interface ImageUsageInput {
  provider: AiProvider;
  model: string;
  imageCount: number;
  size?: string;
  quality?: 'low' | 'medium' | 'high';
}

export interface SpeechUsageInput {
  provider: AiProvider;
  model: string;
  durationSeconds: number;
  estimated?: boolean;
}
