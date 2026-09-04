import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface GeminiChatResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

/**
 * Gemini chat provider.
 *
 * Exists to back the OpenAI provider in AiChatService's fallback chain: the
 * dependency and GEMINI_API_KEY were already present but nothing ever called
 * them, so an OpenAI outage took every AI feature down with it.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenerativeAI | null = null;
  private readonly modelName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName =
      this.configService.get<string>('GEMINI_CHAT_MODEL') || 'gemini-3.6-flash';

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set. Gemini fallback is disabled.');
    } else {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async chatWithUsage(
    messages: ChatMessage[],
    temperature = 0.7,
    maxTokens = 2048,
  ): Promise<GeminiChatResult> {
    if (!this.client) {
      throw new Error('Gemini API not configured');
    }

    // Gemini takes the system prompt out of band and only understands
    // user/model turns, so system messages are hoisted and the rest remapped.
    const systemInstruction = messages
      .filter((m) => m.role === MessageRole.System)
      .map((m) => m.content)
      .join('\n\n');

    const mapped = messages
      .filter((m) => m.role !== MessageRole.System)
      .map((m) => ({
        role: m.role === MessageRole.Assistant ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Gemini rejects a history that opens with a model turn, and rejects two
    // consecutive turns from the same role. Our conversations always start with
    // a stored assistant greeting, so both need normalising before we send.
    const firstUserIndex = mapped.findIndex((t) => t.role === 'user');
    const trimmed = firstUserIndex === -1 ? [] : mapped.slice(firstUserIndex);

    const turns: typeof mapped = [];
    for (const turn of trimmed) {
      const previous = turns[turns.length - 1];
      if (previous && previous.role === turn.role) {
        // Merge same-role runs rather than dropping content.
        previous.parts[0].text += `

${turn.parts[0].text}`;
        continue;
      }
      turns.push(turn);
    }

    if (turns.length === 0) {
      throw new Error('Gemini requires at least one user message');
    }

    // startChat requires the history to end on a model turn, since the final
    // user turn is sent separately as the prompt.
    if (turns[turns.length - 1].role !== 'user') {
      throw new Error('Gemini conversation must end with a user message');
    }

    const model: GenerativeModel = this.client.getGenerativeModel({
      model: this.modelName,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    // The final turn is the prompt; everything before it is prior context.
    const history = turns.slice(0, -1);
    const latest = turns[turns.length - 1];

    const chat = model.startChat(history.length ? { history } : {});
    const result = await chat.sendMessage(latest.parts[0].text);

    const content =
      result.response.text() ||
      'I apologize, but I could not generate a response.';

    const meta = result.response.usageMetadata;

    return {
      content,
      usage: {
        promptTokens: meta?.promptTokenCount ?? 0,
        completionTokens: meta?.candidatesTokenCount ?? 0,
        totalTokens:
          meta?.totalTokenCount ??
          (meta?.promptTokenCount ?? 0) + (meta?.candidatesTokenCount ?? 0),
      },
      model: this.modelName,
    };
  }
}
