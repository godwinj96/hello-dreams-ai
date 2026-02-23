import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbeddingService, ContentType } from './embedding.service';
import { UserContextEmbedding } from '../entities/user-context-embedding.entity';

@Injectable()
export class ContextIndexerService {
  private readonly logger = new Logger(ContextIndexerService.name);

  constructor(
    private embeddingService: EmbeddingService,
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
  ): Promise<UserContextEmbedding> {
    try {
      // Extract text from resume content
      const text = this.extractResumeText(resumeContent);

      // Generate embedding
      const embeddingResult = await this.embeddingService.generateEmbedding(text);

      // Check if embedding already exists
      const existing = await this.embeddingRepository.findOne({
        where: {
          userId,
          contentType: 'resume',
          contentId: resumeId,
        },
      });

      if (existing) {
        // Update existing embedding
        existing.content = text;
        existing.embedding = embeddingResult.embedding;
        existing.metadata = {
          ...existing.metadata,
          model: embeddingResult.model,
          updatedAt: new Date().toISOString(),
        };
        return await this.embeddingRepository.save(existing);
      } else {
        // Create new embedding
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
        return await this.embeddingRepository.save(embedding);
      }
    } catch (error) {
      this.logger.error(`Error indexing resume ${resumeId}`, error);
      throw error;
    }
  }

  /**
   * Index a document by generating and storing its embedding
   */
  async indexDocument(
    documentId: string,
    userId: string,
    documentContent: any,
  ): Promise<UserContextEmbedding> {
    try {
      // Extract text from document content
      const text = this.extractDocumentText(documentContent);

      // Generate embedding
      const embeddingResult = await this.embeddingService.generateEmbedding(text);

      // Check if embedding already exists
      const existing = await this.embeddingRepository.findOne({
        where: {
          userId,
          contentType: 'document',
          contentId: documentId,
        },
      });

      if (existing) {
        // Update existing embedding
        existing.content = text;
        existing.embedding = embeddingResult.embedding;
        existing.metadata = {
          ...existing.metadata,
          model: embeddingResult.model,
          updatedAt: new Date().toISOString(),
        };
        return await this.embeddingRepository.save(existing);
      } else {
        // Create new embedding
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
        return await this.embeddingRepository.save(embedding);
      }
    } catch (error) {
      this.logger.error(`Error indexing document ${documentId}`, error);
      throw error;
    }
  }

  /**
   * Index persona data by generating and storing its embedding
   */
  async indexPersona(
    userId: string,
    personaData: any,
  ): Promise<UserContextEmbedding> {
    try {
      // Extract text from persona data
      const text = this.extractPersonaText(personaData);

      // Generate embedding
      const embeddingResult = await this.embeddingService.generateEmbedding(text);

      // Use userId as contentId for persona (one per user)
      const contentId = userId;

      // Check if embedding already exists
      const existing = await this.embeddingRepository.findOne({
        where: {
          userId,
          contentType: 'profile',
          contentId,
        },
      });

      if (existing) {
        // Update existing embedding
        existing.content = text;
        existing.embedding = embeddingResult.embedding;
        existing.metadata = {
          ...existing.metadata,
          model: embeddingResult.model,
          updatedAt: new Date().toISOString(),
        };
        return await this.embeddingRepository.save(existing);
      } else {
        // Create new embedding
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
        return await this.embeddingRepository.save(embedding);
      }
    } catch (error) {
      this.logger.error(`Error indexing persona for user ${userId}`, error);
      throw error;
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

    if (resumeContent.contactInfo) {
      if (resumeContent.contactInfo.fullName) parts.push(`Name: ${resumeContent.contactInfo.fullName}`);
      if (resumeContent.contactInfo.title) parts.push(`Title: ${resumeContent.contactInfo.title}`);
    }

    if (resumeContent.summary) {
      parts.push(`Summary: ${resumeContent.summary}`);
    }

    if (resumeContent.workExperience && Array.isArray(resumeContent.workExperience)) {
      resumeContent.workExperience.forEach((exp: any) => {
        if (exp.jobTitle) parts.push(`Job Title: ${exp.jobTitle}`);
        if (exp.company) parts.push(`Company: ${exp.company}`);
        if (exp.responsibilities && Array.isArray(exp.responsibilities)) {
          parts.push(`Responsibilities: ${exp.responsibilities.join(', ')}`);
        }
        if (exp.achievements && Array.isArray(exp.achievements)) {
          parts.push(`Achievements: ${exp.achievements.join(', ')}`);
        }
      });
    }

    if (resumeContent.skills) {
      if (resumeContent.skills.technical && Array.isArray(resumeContent.skills.technical)) {
        parts.push(`Technical Skills: ${resumeContent.skills.technical.join(', ')}`);
      }
      if (resumeContent.skills.soft && Array.isArray(resumeContent.skills.soft)) {
        parts.push(`Soft Skills: ${resumeContent.skills.soft.join(', ')}`);
      }
    }

    if (resumeContent.education && Array.isArray(resumeContent.education)) {
      resumeContent.education.forEach((edu: any) => {
        if (edu.degree) parts.push(`Degree: ${edu.degree}`);
        if (edu.institution) parts.push(`Institution: ${edu.institution}`);
      });
    }

    return parts.join('\n');
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
      if (documentContent.meta.targetRole) parts.push(`Target Role: ${documentContent.meta.targetRole}`);
      if (documentContent.meta.targetCompany) parts.push(`Target Company: ${documentContent.meta.targetCompany}`);
    }

    return parts.join('\n');
  }

  /**
   * Extract text from persona data for embedding
   */
  private extractPersonaText(personaData: any): string {
    const parts: string[] = [];

    if (personaData.persona) {
      if (personaData.persona.communicationStyle) {
        parts.push(`Communication Style: ${personaData.persona.communicationStyle}`);
      }
      if (personaData.persona.tone) {
        parts.push(`Tone: ${personaData.persona.tone}`);
      }
      if (personaData.persona.professionalVoice) {
        parts.push(`Professional Voice: ${personaData.persona.professionalVoice}`);
      }
      if (personaData.persona.writingStyle) {
        parts.push(`Writing Style: ${personaData.persona.writingStyle}`);
      }
      if (personaData.persona.personalityTraits && Array.isArray(personaData.persona.personalityTraits)) {
        parts.push(`Personality Traits: ${personaData.persona.personalityTraits.join(', ')}`);
      }
    }

    if (personaData.personaData) {
      if (personaData.personaData.currentPersona) {
        parts.push(`Current Persona: ${personaData.personaData.currentPersona}`);
      }
      if (personaData.personaData.idealPersona) {
        parts.push(`Ideal Persona: ${personaData.personaData.idealPersona}`);
      }
    }

    if (personaData.careerGoals) {
      if (personaData.careerGoals.careerAspirations) {
        parts.push(`Career Aspirations: ${personaData.careerGoals.careerAspirations}`);
      }
      if (personaData.careerGoals.targetRoles && Array.isArray(personaData.careerGoals.targetRoles)) {
        parts.push(`Target Roles: ${personaData.careerGoals.targetRoles.join(', ')}`);
      }
    }

    return parts.join('\n');
  }
}




