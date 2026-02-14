import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';
import { PromptInjectionGuardService } from './prompt-injection-guard.service';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;
  private readonly defaultChatModel: string;

  constructor(
    private configService: ConfigService,
    @Optional() @Inject(PromptInjectionGuardService)
    private promptInjectionGuard?: PromptInjectionGuardService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const configuredModel =
      this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4.1-mini';
    this.defaultChatModel = configuredModel;
    
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set. OpenAI services will not work.',
      );
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Chat completion using OpenAI
   * Returns both content and usage information
   */
  async chat(
    messages: ChatMessage[],
    model: string = this.defaultChatModel,
    temperature: number = 0.7,
    maxTokens: number = 2048,
  ): Promise<string> {
    const result = await this.chatWithUsage(messages, model, temperature, maxTokens);
    return result.content;
  }

  /**
   * Chat completion with usage tracking
   */
  async chatWithUsage(
    messages: ChatMessage[],
    model: string = this.defaultChatModel,
    temperature: number = 0.7,
    maxTokens: number = 2048,
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
  }> {
    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      // Sanitize user messages to prevent prompt injection
      const sanitizedMessages = this.sanitizeMessages(messages);

      // Convert our message format to OpenAI format
      const openAIMessages = sanitizedMessages.map((msg) => ({
        role: this.mapRoleToOpenAI(msg.role),
        content: msg.content,
      }));

      const response = await this.openai.chat.completions.create({
        model,
        messages: openAIMessages as any,
        temperature,
        max_tokens: maxTokens,
      });

      const content =
        response.choices[0]?.message?.content ||
        'I apologize, but I could not generate a response.';

      const usage = response.usage
        ? {
            promptTokens: response.usage.prompt_tokens || 0,
            completionTokens: response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0,
          }
        : {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          };

      return {
        content,
        usage,
        model,
      };
    } catch (error) {
      this.logger.error('Error in OpenAI chat', error);
      throw error;
    }
  }

  /**
   * Map our MessageRole enum to OpenAI role format
   */
  private mapRoleToOpenAI(role: MessageRole): 'system' | 'user' | 'assistant' {
    switch (role) {
      case MessageRole.System:
        return 'system';
      case MessageRole.User:
        return 'user';
      case MessageRole.Assistant:
        return 'assistant';
      default:
        return 'user';
    }
  }

  /**
   * Sanitize messages to prevent prompt injection
   */
  private sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
    if (!this.promptInjectionGuard) {
      return messages;
    }

    return messages.map((msg) => {
      // Only sanitize user messages, not system or assistant messages
      if (msg.role === MessageRole.User) {
        const checkResult = this.promptInjectionGuard!.checkInput(msg.content);
        if (!checkResult.isSafe) {
          this.logger.warn('Suspicious input detected in OpenAI message', {
            patterns: checkResult.suspiciousPatterns,
          });
          return {
            ...msg,
            content: checkResult.sanitizedInput || msg.content,
          };
        }
      }
      return msg;
    });
  }

  /**
   * Extract structured data from text using OpenAI
   */
  async extractStructuredData(
    text: string,
    schema: Record<string, any>,
    systemPrompt?: string,
  ): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      const prompt = systemPrompt || 'Extract structured data from the following text according to the provided schema. Return only valid JSON.';
      
      const messages: ChatMessage[] = [
        {
          role: MessageRole.System,
          content: `${prompt}\n\nSchema: ${JSON.stringify(schema, null, 2)}`,
        },
        {
          role: MessageRole.User,
          content: text,
        },
      ];

      const response = await this.chat(messages, this.defaultChatModel, 0.3);
      
      // Try to parse JSON from response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        this.logger.warn('Failed to parse JSON from OpenAI response', parseError);
      }

      return null;
    } catch (error) {
      this.logger.error('Error extracting structured data', error);
      throw error;
    }
  }

  /**
   * Analyze images using OpenAI vision capabilities
   * Uses Chat Completions API with vision-capable models (e.g., gpt-4o, gpt-4o-mini)
   */
  async analyzeImage(
    imageUrl: string,
    prompt: string,
    model: string = 'gpt-4o-mini',
    temperature: number = 0.7,
    maxTokens: number = 1024,
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
  }> {
    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      const content =
        response.choices[0]?.message?.content ||
        'I apologize, but I could not analyze the image.';

      const usage = response.usage
        ? {
            promptTokens: response.usage.prompt_tokens || 0,
            completionTokens: response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0,
          }
        : {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          };

      return {
        content,
        usage,
        model,
      };
    } catch (error) {
      this.logger.error('Error analyzing image with OpenAI', error);
      throw error;
    }
  }
}










