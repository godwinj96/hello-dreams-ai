import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbeddingService, ContentType } from './embedding.service';
import { UserContextEmbedding } from '../entities/user-context-embedding.entity';
import { EmbeddingRetryService } from './embedding-retry.service';

@Injectable()
export class ContextIndexerService {
  private readonly logger = new Logger(ContextIndexerService.name);

  constructor(
    private embeddingService: EmbeddingService,
    private embeddingRetryService: EmbeddingRetryService,
    @InjectRepository(UserContextEmbedding)
    private embeddingRepository: Repository<UserContextEmbedding>,
  ) {}

  /**
   * Index a resume by generating and storing its embedding
   */
  async indexResume(
    resumeId: string,
    userId: string,
    resumeContent: any,
  ): Promise<{
    record: UserContextEmbedding | null;
    embeddingUsage?: {
      model: string;
      promptTokens: number;
      totalTokens: number;
    };
  }> {
    try {
      // Extract text from resume content
      const text = this.extractResumeText(resumeContent);

      if (!text || text.trim().length === 0) {
        this.logger.warn(
          `Skipping resume embedding for resume ${resumeId}: extracted text is empty`,
        );
        return { record: null };
      }

      const embeddingResult =
        await this.embeddingService.generateEmbedding(text);
      const embeddingUsage = {
        model: embeddingResult.model,
        promptTokens: embeddingResult.usage.promptTokens,
        totalTokens: embeddingResult.usage.totalTokens,
      };

      const existing = await this.embeddingRepository.findOne({
        where: {
          userId,
          contentType: 'resume',
          contentId: resumeId,
        },
      });

      if (existing) {
        existing.content = text;
        existing.embedding = embeddingResult.embedding;
        existing.metadata = {
          ...existing.metadata,
          model: embeddingResult.model,
          updatedAt: new Date().toISOString(),
        };
        return {
          record: await this.embeddingRepository.save(existing),
          embeddingUsage,
        };
      }

      const embedding = this.embeddingRepository.create({
        userId,
        contentType: 'resume',
        contentId: resumeId,
        content: text,
        embedding: embeddingResult.embedding,
        metadata: {
          model: embeddingResult.model,
          createdAt: new Date().toISOString(),
        },
      });
      return {
        record: await this.embeddingRepository.save(embedding),
        embeddingUsage,
      };
    } catch (error) {
      this.logger.warn(
        `Resume embedding indexing skipped for ${resumeId} (app continues without vector index)`,
        error instanceof Error ? error.message : String(error),
      );
      this.embeddingRetryService.scheduleResumeReindex(resumeId, userId);
      return { record: null };
    }
  }

  /**
   * Index a document by generating and storing its embedding
   */
  async indexDocument(
    documentId: string,
    userId: string,
    documentContent: any,
  ): Promise<{
    record: UserContextEmbedding | null;
    embeddingUsage?: {
      model: string;
      promptTokens: number;
      totalTokens: number;
    };
  }> {
    try {
      // Extract text from document content
      const text = this.extractDocumentText(documentContent);

      if (!text || text.trim().length === 0) {
        this.logger.warn(
          `Skipping document embedding for document ${documentId}: extracted text is empty`,
        );
        return { record: null };
      }

      const embeddingResult =
        await this.embeddingService.generateEmbedding(text);
      const embeddingUsage = {
        model: embeddingResult.model,
        promptTokens: embeddingResult.usage.promptTokens,
        totalTokens: embeddingResult.usage.totalTokens,
      };

      const existing = await this.embeddingRepository.findOne({
        where: {
          userId,
          contentType: 'document',
          contentId: documentId,
        },
      });

      if (existing) {
        existing.content = text;
        existing.embedding = embeddingResult.embedding;
        existing.metadata = {
          ...existing.metadata,
          model: embeddingResult.model,
          updatedAt: new Date().toISOString(),
        };
        return {
          record: await this.embeddingRepository.save(existing),
          embeddingUsage,
        };
      }

      const embedding = this.embeddingRepository.create({
        userId,
        contentType: 'document',
        contentId: documentId,
        content: text,
        embedding: embeddingResult.embedding,
        metadata: {
          model: embeddingResult.model,
          documentType: documentContent.documentType,
          createdAt: new Date().toISOString(),
        },
      });
      return {
        record: await this.embeddingRepository.save(embedding),
        embeddingUsage,
      };
    } catch (error) {
      this.logger.warn(
        `Document embedding indexing skipped for ${documentId} (app continues without vector index)`,
        error instanceof Error ? error.message : String(error),
      );
      this.embeddingRetryService.scheduleDocumentReindex(documentId, userId);
      return { record: null };
    }
  }

  /**
   * Index persona data by generating and storing its embedding
   */
  async indexPersona(
    userId: string,
    personaData: any,
  ): Promise<{
    record: UserContextEmbedding | null;
    embeddingUsage?: {
      model: string;
      promptTokens: number;
      totalTokens: number;
    };
  }> {
    try {
      // Extract text from persona data
      const text = this.extractPersonaText(personaData);

      // Guard: don't attempt embeddings for empty text.
      // This can happen when a user hasn't generated/appplied persona yet.
      if (!text || text.trim().length === 0) {
        const currentPersona = personaData?.personaData?.currentPersona;
        const idealPersona = personaData?.personaData?.idealPersona;
        const hasPersonaFields =
          !!personaData?.persona?.communicationStyle ||
          !!personaData?.persona?.tone ||
          !!personaData?.persona?.professionalVoice ||
          !!personaData?.persona?.writingStyle ||
          (Array.isArray(personaData?.persona?.personalityTraits) &&
            personaData.persona.personalityTraits.length > 0);

        this.logger.warn(
          `Skipping persona embedding for user ${userId}: extracted persona text is empty`,
          {
            currentPersona: currentPersona ?? null,
            idealPersona: idealPersona ?? null,
            hasPersonaFields,
          },
        );
        return { record: null };
      }

      const embeddingResult =
        await this.embeddingService.generateEmbedding(text);
      const embeddingUsage = {
        model: embeddingResult.model,
        promptTokens: embeddingResult.usage.promptTokens,
        totalTokens: embeddingResult.usage.totalTokens,
      };

      const contentId = userId;

      const existing = await this.embeddingRepository.findOne({
        where: {
          userId,
          contentType: 'profile',
          contentId,
        },
      });

      if (existing) {
        existing.content = text;
        existing.embedding = embeddingResult.embedding;
        existing.metadata = {
          ...existing.metadata,
          model: embeddingResult.model,
          updatedAt: new Date().toISOString(),
        };
        return {
          record: await this.embeddingRepository.save(existing),
          embeddingUsage,
        };
      }

      const embedding = this.embeddingRepository.create({
        userId,
        contentType: 'profile',
        contentId,
        content: text,
        embedding: embeddingResult.embedding,
        metadata: {
          model: embeddingResult.model,
          createdAt: new Date().toISOString(),
        },
      });
      return {
        record: await this.embeddingRepository.save(embedding),
        embeddingUsage,
      };
    } catch (error) {
      this.logger.warn(
        `Persona/profile embedding indexing skipped for user ${userId} (app continues without vector index)`,
        error instanceof Error ? error.message : String(error),
      );
      this.embeddingRetryService.schedulePersonaReindex(userId);
      return { record: null };
    }
  }

  /**
   * Index a career profile conversation by concatenating all user messages.
   * This makes everything the user says during onboarding (name, experience, goals)
   * searchable by resume builder and document generator via semantic similarity.
   *
   * Uses the conversationId as contentId so the record is upserted on subsequent calls
   * (the conversation grows over time — we overwrite with the latest full text).
   */
  async indexConversation(
    conversationId: string,
    userId: string,
    userMessages: string[],
  ): Promise<{
    record: UserContextEmbedding | null;
    embeddingUsage?: {
      model: string;
      promptTokens: number;
      totalTokens: number;
    };
  }> {
    try {
      const text = userMessages
        .map((m) => m.trim())
        .filter((m) => m.length > 0)
        .join('\n');

      if (!text) {
        this.logger.warn(
          `Skipping conversation embedding for ${conversationId}: no user messages`,
        );
        return { record: null };
      }

      const embeddingResult =
        await this.embeddingService.generateEmbedding(text);
      const embeddingUsage = {
        model: embeddingResult.model,
        promptTokens: embeddingResult.usage.promptTokens,
        totalTokens: embeddingResult.usage.totalTokens,
      };

      const existing = await this.embeddingRepository.findOne({
        where: {
          userId,
          contentType: 'conversation',
          contentId: conversationId,
        },
      });

      if (existing) {
        existing.content = text;
        existing.embedding = embeddingResult.embedding;
        existing.metadata = {
          ...existing.metadata,
          model: embeddingResult.model,
          updatedAt: new Date().toISOString(),
        };
        return {
          record: await this.embeddingRepository.save(existing),
          embeddingUsage,
        };
      }

      const embedding = this.embeddingRepository.create({
        userId,
        contentType: 'conversation',
        contentId: conversationId,
        content: text,
        embedding: embeddingResult.embedding,
        metadata: {
          model: embeddingResult.model,
          createdAt: new Date().toISOString(),
        },
      });
      return {
        record: await this.embeddingRepository.save(embedding),
        embeddingUsage,
      };
    } catch (error) {
      this.logger.warn(
        `Conversation embedding skipped for ${conversationId} (app continues)`,
        error instanceof Error ? error.message : String(error),
      );
      return { record: null };
    }
  }

  /**
   * Delete embedding by contentId and contentType
   */
  async deleteEmbedding(
    userId: string,
    contentType: ContentType,
    contentId: string,
  ): Promise<void> {
    await this.embeddingRepository.delete({
      userId,
      contentType,
      contentId,
    });
  }

  /**
   * Extract text from resume content for embedding
   */
  private extractResumeText(resumeContent: any): string {
    const parts: string[] = [];

    // ResumeData entity uses contactInfo; AI resume JSON (ResumeJson) uses contact
    const contact = resumeContent.contactInfo || resumeContent.contact;
    if (contact) {
      if (contact.fullName) parts.push(`Name: ${contact.fullName}`);
      if (contact.title) parts.push(`Title: ${contact.title}`);
      if (contact.email) parts.push(`Email: ${contact.email}`);
      if (contact.phone) parts.push(`Phone: ${contact.phone}`);
      if (contact.location) parts.push(`Location: ${contact.location}`);
      const links = contact.links;
      if (links?.linkedIn) parts.push(`LinkedIn: ${links.linkedIn}`);
      if (links?.github) parts.push(`GitHub: ${links.github}`);
      if (links?.portfolio) parts.push(`Portfolio: ${links.portfolio}`);
    }

    if (resumeContent.summary) {
      parts.push(`Summary: ${resumeContent.summary}`);
    }

    if (
      resumeContent.workExperience &&
      Array.isArray(resumeContent.workExperience)
    ) {
      resumeContent.workExperience.forEach((exp: any) => {
        if (exp.jobTitle) parts.push(`Job Title: ${exp.jobTitle}`);
        if (exp.company) parts.push(`Company: ${exp.company}`);
        if (exp.responsibilities && Array.isArray(exp.responsibilities)) {
          parts.push(`Responsibilities: ${exp.responsibilities.join(', ')}`);
        }
        if (exp.achievements && Array.isArray(exp.achievements)) {
          parts.push(`Achievements: ${exp.achievements.join(', ')}`);
        }
        if (exp.highlights && Array.isArray(exp.highlights)) {
          parts.push(`Highlights: ${exp.highlights.join(', ')}`);
        }
        if (exp.tools && Array.isArray(exp.tools)) {
          parts.push(`Tools: ${exp.tools.join(', ')}`);
        }
      });
    }

    if (resumeContent.skills) {
      const sk = resumeContent.skills;
      if (sk.core && Array.isArray(sk.core)) {
        parts.push(`Core Skills: ${sk.core.join(', ')}`);
      }
      if (sk.technical && Array.isArray(sk.technical)) {
        parts.push(`Technical Skills: ${sk.technical.join(', ')}`);
      }
      if (sk.soft && Array.isArray(sk.soft)) {
        parts.push(`Soft Skills: ${sk.soft.join(', ')}`);
      }
      if (sk.tools && Array.isArray(sk.tools)) {
        parts.push(`Tools: ${sk.tools.join(', ')}`);
      }
      if (sk.languages && Array.isArray(sk.languages)) {
        parts.push(`Languages: ${sk.languages.join(', ')}`);
      }
    }

    if (resumeContent.education && Array.isArray(resumeContent.education)) {
      resumeContent.education.forEach((edu: any) => {
        if (edu.degree) parts.push(`Degree: ${edu.degree}`);
        if (edu.institution) parts.push(`Institution: ${edu.institution}`);
      });
    }

    if (resumeContent.projects && Array.isArray(resumeContent.projects)) {
      resumeContent.projects.forEach((p: any) => {
        if (p.name) parts.push(`Project: ${p.name}`);
        if (p.description) parts.push(`Project description: ${p.description}`);
        if (p.technologies && Array.isArray(p.technologies)) {
          parts.push(`Technologies: ${p.technologies.join(', ')}`);
        }
      });
    }

    if (
      resumeContent.certifications &&
      Array.isArray(resumeContent.certifications)
    ) {
      resumeContent.certifications.forEach((c: any) => {
        if (c.name) parts.push(`Certification: ${c.name}`);
      });
    }

    if (
      resumeContent.achievements &&
      Array.isArray(resumeContent.achievements)
    ) {
      resumeContent.achievements.forEach((a: any) => {
        if (a.title) parts.push(`Achievement: ${a.title}`);
        if (a.description) parts.push(a.description);
      });
    }

    const structured = parts.join('\n').trim();
    if (structured.length > 0) {
      return structured;
    }

    // Schema drift / legacy shapes: still embed something retrievable
    if (
      resumeContent &&
      typeof resumeContent === 'object' &&
      !Array.isArray(resumeContent) &&
      Object.keys(resumeContent).length > 0
    ) {
      try {
        const raw = JSON.stringify(resumeContent);
        const maxFallback = 48_000;
        return raw.length > maxFallback ? raw.slice(0, maxFallback) : raw;
      } catch {
        return '';
      }
    }

    return '';
  }

  /**
   * Extract text from document content for embedding
   */
  private extractDocumentText(documentContent: any): string {
    const parts: string[] = [];

    if (documentContent.documentType) {
      parts.push(`Document Type: ${documentContent.documentType}`);
    }

    if (documentContent.sections && Array.isArray(documentContent.sections)) {
      documentContent.sections.forEach((section: any) => {
        if (section.heading) parts.push(`Section: ${section.heading}`);
        if (section.paragraphs && Array.isArray(section.paragraphs)) {
          parts.push(section.paragraphs.join('\n'));
        }
        if (section.bullets && Array.isArray(section.bullets)) {
          parts.push(section.bullets.join('\n'));
        }
      });
    }

    if (documentContent.meta) {
      if (documentContent.meta.targetRole)
        parts.push(`Target Role: ${documentContent.meta.targetRole}`);
      if (documentContent.meta.targetCompany)
        parts.push(`Target Company: ${documentContent.meta.targetCompany}`);
      if (documentContent.meta.jobDescriptionSummary) {
        parts.push(
          `Job summary: ${documentContent.meta.jobDescriptionSummary}`,
        );
      }
    }

    if (documentContent.closing) {
      const c = documentContent.closing;
      if (c.signoff) parts.push(`Signoff: ${c.signoff}`);
      if (c.signature) parts.push(`Signature: ${c.signature}`);
    }

    const structured = parts.join('\n').trim();
    if (structured.length > 0) {
      return structured;
    }

    if (
      documentContent &&
      typeof documentContent === 'object' &&
      !Array.isArray(documentContent) &&
      Object.keys(documentContent).length > 0
    ) {
      try {
        const raw = JSON.stringify(documentContent);
        const maxFallback = 48_000;
        return raw.length > maxFallback ? raw.slice(0, maxFallback) : raw;
      } catch {
        return '';
      }
    }

    return '';
  }

  /**
   * Extract text from persona data for embedding
   */
  private extractPersonaText(personaData: any): string {
    const parts: string[] = [];

    if (personaData.persona) {
      if (personaData.persona.communicationStyle) {
        parts.push(
          `Communication Style: ${personaData.persona.communicationStyle}`,
        );
      }
      if (personaData.persona.tone) {
        parts.push(`Tone: ${personaData.persona.tone}`);
      }
      if (personaData.persona.professionalVoice) {
        parts.push(
          `Professional Voice: ${personaData.persona.professionalVoice}`,
        );
      }
      if (personaData.persona.writingStyle) {
        parts.push(`Writing Style: ${personaData.persona.writingStyle}`);
      }
      if (
        personaData.persona.personalityTraits &&
        Array.isArray(personaData.persona.personalityTraits)
      ) {
        parts.push(
          `Personality Traits: ${personaData.persona.personalityTraits.join(', ')}`,
        );
      }
    }

    if (personaData.personaData) {
      if (personaData.personaData.currentPersona) {
        parts.push(
          `Current Persona: ${personaData.personaData.currentPersona}`,
        );
      }
      if (personaData.personaData.idealPersona) {
        parts.push(`Ideal Persona: ${personaData.personaData.idealPersona}`);
      }
    }

    if (personaData.careerGoals) {
      if (personaData.careerGoals.careerAspirations) {
        parts.push(
          `Career Aspirations: ${personaData.careerGoals.careerAspirations}`,
        );
      }
      if (
        personaData.careerGoals.targetRoles &&
        Array.isArray(personaData.careerGoals.targetRoles)
      ) {
        parts.push(
          `Target Roles: ${personaData.careerGoals.targetRoles.join(', ')}`,
        );
      }
    }

    return parts.join('\n');
  }
}
