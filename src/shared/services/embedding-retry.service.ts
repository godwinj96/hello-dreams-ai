import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resume } from '../../resume-builder/entities/resume.entity';
import { ResumeData } from '../../resume-builder/entities/resume-data.entity';
import { Document } from '../../document-generator/entities/document.entity';
import { ProfessionalProfileService } from '../../professional-profile/professional-profile.service';
import type { ContextIndexerService } from './context-indexer.service';
import { EmbeddingService } from './embedding.service';

/**
 * Best-effort delayed re-indexing when embedding API or DB writes fail.
 * Uses in-process timers (no extra infra). Dedupes per resource key.
 */
@Injectable()
export class EmbeddingRetryService {
  private readonly logger = new Logger(EmbeddingRetryService.name);
  private readonly pendingKeys = new Set<string>();
  private readonly maxAttempts = 5;
  private readonly delaysMs = [15_000, 60_000, 300_000, 900_000, 3_600_000];

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly embeddingService: EmbeddingService,
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    @InjectRepository(ResumeData)
    private readonly resumeDataRepository: Repository<ResumeData>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly professionalProfileService: ProfessionalProfileService,
  ) {}

  scheduleResumeReindex(resumeId: string, userId: string): void {
    if (!this.embeddingService.isEmbeddingsAvailable()) {
      return;
    }
    const key = `resume:${resumeId}`;
    if (this.pendingKeys.has(key)) {
      return;
    }
    this.pendingKeys.add(key);
    this.logger.log(
      `Scheduled resume embedding reindex (attempts up to ${this.maxAttempts})`,
      { resumeId, userId },
    );
    this.runResumeAttempt(resumeId, userId, 0, key);
  }

  scheduleDocumentReindex(documentId: string, userId: string): void {
    if (!this.embeddingService.isEmbeddingsAvailable()) {
      return;
    }
    const key = `document:${documentId}`;
    if (this.pendingKeys.has(key)) {
      return;
    }
    this.pendingKeys.add(key);
    this.logger.log(
      `Scheduled document embedding reindex (attempts up to ${this.maxAttempts})`,
      { documentId, userId },
    );
    this.runDocumentAttempt(documentId, userId, 0, key);
  }

  schedulePersonaReindex(userId: string): void {
    if (!this.embeddingService.isEmbeddingsAvailable()) {
      return;
    }
    const key = `profile:${userId}`;
    if (this.pendingKeys.has(key)) {
      return;
    }
    this.pendingKeys.add(key);
    this.logger.log(
      `Scheduled persona/profile embedding reindex (attempts up to ${this.maxAttempts})`,
      { userId },
    );
    this.runPersonaAttempt(userId, 0, key);
  }

  private async getIndexer(): Promise<ContextIndexerService> {
    const { ContextIndexerService } = await import(
      './context-indexer.service.js'
    );
    return this.moduleRef.get(ContextIndexerService, { strict: false });
  }

  private delayForAttempt(attempt: number): number {
    return this.delaysMs[Math.min(attempt, this.delaysMs.length - 1)] ?? 60_000;
  }

  private runResumeAttempt(
    resumeId: string,
    userId: string,
    attempt: number,
    key: string,
  ): void {
    const waitMs = this.delayForAttempt(attempt);
    setTimeout(() => {
      void (async () => {
        try {
          const resume = await this.resumeRepository.findOne({
            where: { id: resumeId },
          });
          if (!resume || resume.userId !== userId) {
            this.pendingKeys.delete(key);
            return;
          }
          const resumeData = await this.resumeDataRepository.findOne({
            where: { resumeId },
          });
          const indexer = await this.getIndexer();
          const result = resumeData
            ? await indexer.indexResume(resumeId, userId, resumeData)
            : await indexer.indexResume(resumeId, userId, resume.content);

          if (result.record !== null) {
            this.pendingKeys.delete(key);
            this.logger.log('Resume embedding reindex succeeded', {
              resumeId,
              userId,
            });
            return;
          }

          if (attempt + 1 < this.maxAttempts) {
            this.runResumeAttempt(resumeId, userId, attempt + 1, key);
          } else {
            this.logger.warn('Resume embedding reindex exhausted retries', {
              resumeId,
              userId,
            });
            this.pendingKeys.delete(key);
          }
        } catch (err) {
          this.logger.warn('Resume embedding reindex attempt failed', {
            resumeId,
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
          if (attempt + 1 < this.maxAttempts) {
            this.runResumeAttempt(resumeId, userId, attempt + 1, key);
          } else {
            this.pendingKeys.delete(key);
          }
        }
      })();
    }, waitMs);
  }

  private runDocumentAttempt(
    documentId: string,
    userId: string,
    attempt: number,
    key: string,
  ): void {
    const waitMs = this.delayForAttempt(attempt);
    setTimeout(() => {
      void (async () => {
        try {
          const doc = await this.documentRepository.findOne({
            where: { id: documentId },
          });
          if (!doc || doc.userId !== userId) {
            this.pendingKeys.delete(key);
            return;
          }
          const indexer = await this.getIndexer();
          const result = await indexer.indexDocument(
            documentId,
            userId,
            doc.content,
          );

          if (result.record !== null) {
            this.pendingKeys.delete(key);
            this.logger.log('Document embedding reindex succeeded', {
              documentId,
              userId,
            });
            return;
          }

          if (attempt + 1 < this.maxAttempts) {
            this.runDocumentAttempt(documentId, userId, attempt + 1, key);
          } else {
            this.logger.warn('Document embedding reindex exhausted retries', {
              documentId,
              userId,
            });
            this.pendingKeys.delete(key);
          }
        } catch (err) {
          this.logger.warn('Document embedding reindex attempt failed', {
            documentId,
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
          if (attempt + 1 < this.maxAttempts) {
            this.runDocumentAttempt(documentId, userId, attempt + 1, key);
          } else {
            this.pendingKeys.delete(key);
          }
        }
      })();
    }, waitMs);
  }

  private runPersonaAttempt(
    userId: string,
    attempt: number,
    key: string,
  ): void {
    const waitMs = this.delayForAttempt(attempt);
    setTimeout(() => {
      void (async () => {
        try {
          const profile =
            await this.professionalProfileService.getProfileForGeneration(
              userId,
            );
          const indexer = await this.getIndexer();
          const result = await indexer.indexPersona(userId, {
            persona: profile.persona,
            personaData: profile.personaData,
            careerGoals: profile.careerGoals,
          });

          if (result.record !== null) {
            this.pendingKeys.delete(key);
            this.logger.log('Persona/profile embedding reindex succeeded', {
              userId,
            });
            return;
          }

          if (attempt + 1 < this.maxAttempts) {
            this.runPersonaAttempt(userId, attempt + 1, key);
          } else {
            this.logger.warn(
              'Persona/profile embedding reindex exhausted retries',
              { userId },
            );
            this.pendingKeys.delete(key);
          }
        } catch (err) {
          this.logger.warn('Persona embedding reindex attempt failed', {
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
          if (attempt + 1 < this.maxAttempts) {
            this.runPersonaAttempt(userId, attempt + 1, key);
          } else {
            this.pendingKeys.delete(key);
          }
        }
      })();
    }, waitMs);
  }
}
