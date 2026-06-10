import { AiCostAccumulator } from './ai-cost-accumulator';
import { AiOperation, AiProvider } from '../types/ai-usage.types';
// AiOperation used by openAIChatAndTrack only
import { OpenAIService } from '../services/openai.service';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';

export function addChatUsageToAccumulator(
  accumulator: AiCostAccumulator | undefined,
  params: {
    operation: 'chat' | 'extraction';
    provider: AiProvider;
    model: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    estimated?: boolean;
  },
): void {
  if (!accumulator) return;
  accumulator.addChat(params);
}

export async function openAIChatAndTrack(
  openAIService: OpenAIService,
  messages: Array<{ role: MessageRole; content: string }>,
  accumulator: AiCostAccumulator | undefined,
  operation: 'chat' | 'extraction' = 'chat',
  temperature?: number,
  maxTokens?: number,
): Promise<string> {
  const result = await openAIService.chatWithUsage(
    messages,
    undefined,
    temperature,
    maxTokens,
  );
  addChatUsageToAccumulator(accumulator, {
    operation,
    provider: 'openai',
    model: result.model,
    usage: result.usage,
  });
  return result.content;
}

export function addExtractionUsageToAccumulator(
  accumulator: AiCostAccumulator | undefined,
  result: {
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
  } | null,
): void {
  if (!accumulator || !result) return;
  addChatUsageToAccumulator(accumulator, {
    operation: 'extraction',
    provider: 'openai',
    model: result.model,
    usage: result.usage,
  });
}
