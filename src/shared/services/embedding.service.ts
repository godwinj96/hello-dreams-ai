import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';

export type ContentType = 'resume' | 'document' | 'conversation' | 'profile';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI | null = null;
  private readonly model = 'text-embedding-3-small';
  private readonly dimensions = 1536; // text-embedding-3-small produces 1536-dimensional vectors

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set. Embedding service will not work.',
      );
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * True when OPENAI_API_KEY is set and the client was created.
   * Retries are skipped when false (common cause of embedding failures).
   */
  isEmbeddingsAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Generate embedding for a text string
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openai) {
      throw new Error(
        'OpenAI API not configured (missing OPENAI_API_KEY). Set OPENAI_API_KEY in the environment.',
      );
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      // Truncate text if too long (OpenAI has token limits)
      const maxTokens = 8000; // text-embedding-3-small supports up to 8191 tokens
      const truncatedText = this.truncateText(text, maxTokens);

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: truncatedText,
        dimensions: this.dimensions,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI');
      }

      return {
        embedding,
        model: this.model,
        usage: {
          promptTokens: response.usage.prompt_tokens || 0,
          totalTokens: response.usage.total_tokens || 0,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error generating embedding: ${this.describeEmbeddingError(error)}`,
      );
      throw error;
    }
  }

  private describeEmbeddingError(error: unknown): string {
    if (error instanceof APIError) {
      const hint =
        error.status === 401
          ? ' (invalid or revoked API key)'
          : error.status === 429
            ? ' (rate limit — retry/backoff applies)'
            : error.status === 503 || error.status === 502
              ? ' (OpenAI temporarily unavailable)'
              : '';
      return `status=${error.status} code=${error.code ?? 'n/a'} type=${error.type ?? 'n/a'} message=${error.message}${hint}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    if (texts.length === 0) {
      return [];
    }

    // OpenAI supports batching, but we'll process in smaller batches to avoid token limits
    const batchSize = 10;
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((text) => this.generateEmbedding(text)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Find most similar embeddings to a query embedding
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: Array<{ embedding: number[]; id: string; metadata?: any }>,
    limit: number = 10,
    minSimilarity: number = 0.5,
  ): Array<{ id: string; similarity: number; metadata?: any }> {
    const similarities: Array<{
      id: string;
      similarity: number;
      metadata?: any;
    }> = [];

    for (const candidate of candidateEmbeddings) {
      try {
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          candidate.embedding,
        );
        similarities.push({
          id: candidate.id,
          similarity,
          metadata: candidate.metadata,
        });
      } catch {
        this.logger.warn(
          `Skipping stored embedding ${candidate.id}: invalid or mismatched vector`,
        );
      }
    }

    return similarities
      .filter((result) => result.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Truncate text to approximate token limit
   * Simple approximation: 1 token ≈ 4 characters
   */
  private truncateText(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars);
  }

  /**
   * Get embedding dimensions for this model
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Get model name
   */
  getModel(): string {
    return this.model;
  }
}




