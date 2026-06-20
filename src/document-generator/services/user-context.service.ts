import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EmbeddingService,
  ContentType,
} from '../../shared/services/embedding.service';
import { UserContextEmbedding } from '../../shared/entities/user-context-embedding.entity';
import { Resume } from '../../resume-builder/entities/resume.entity';
import { ResumeData } from '../../resume-builder/entities/resume-data.entity';
import { Document } from '../entities/document.entity';
import { ProfessionalProfileService } from '../../professional-profile/professional-profile.service';
import { AiCostAccumulator } from '../../shared/utils/ai-cost-accumulator';

export interface RelevantContext {
  content: string;
  contentType: ContentType;
  contentId: string;
  similarity: number;
  metadata?: any;
}

@Injectable()
export class UserContextService {
  private readonly logger = new Logger(UserContextService.name);

  constructor(
    private embeddingService: EmbeddingService,
    @InjectRepository(UserContextEmbedding)
    private embeddingRepository: Repository<UserContextEmbedding>,
    @InjectRepository(Resume)
    private resumeRepository: Repository<Resume>,
    @InjectRepository(ResumeData)
    private resumeDataRepository: Repository<ResumeData>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private professionalProfileService: ProfessionalProfileService,
  ) {}

  /**
   * Get all resumes for a user (not just latest)
   */
  async getAllUserResumes(userId: string): Promise<ResumeData[]> {
    const resumes = await this.resumeRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (resumes.length === 0) {
      return [];
    }

    const resumeDataList = await Promise.all(
      resumes.map((resume) =>
        this.resumeDataRepository.findOne({
          where: { resumeId: resume.id },
        }),
      ),
    );

    return resumeDataList.filter((data) => data !== null);
  }

  /**
   * Get all documents for a user
   */
  async getAllUserDocuments(userId: string): Promise<Document[]> {
    return await this.documentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get user conversation history from all modules
   * This aggregates messages from resume, career, and document conversations
   */
  async getUserConversationHistory(userId: string): Promise<string[]> {
    // For now, we'll use embeddings to get conversation context
    // In the future, we could directly query conversation messages
    const conversationEmbeddings = await this.embeddingRepository.find({
      where: {
        userId,
        contentType: 'conversation',
      },
      order: { createdAt: 'DESC' },
      take: 50, // Limit to recent conversations
    });

    return conversationEmbeddings.map((emb) => emb.content);
  }

  /**
   * Find relevant context using semantic search
   */
  async getRelevantContext(
    userId: string,
    query: string,
    limit: number = 10,
    minSimilarity: number = 0.5,
    costAccumulator?: AiCostAccumulator,
  ): Promise<RelevantContext[]> {
    try {
      const queryEmbedding =
        await this.embeddingService.generateEmbedding(query);
      if (costAccumulator) {
        costAccumulator.addEmbedding({
          provider: 'openai',
          model: queryEmbedding.model,
          promptTokens: queryEmbedding.usage.promptTokens,
          totalTokens: queryEmbedding.usage.totalTokens,
        });
      }

      // Get all user embeddings
      const userEmbeddings = await this.embeddingRepository.find({
        where: { userId },
      });

      if (userEmbeddings.length === 0) {
        return [];
      }

      // Calculate similarities
      const similarities = this.embeddingService.findMostSimilar(
        queryEmbedding.embedding,
        userEmbeddings.map((emb) => ({
          id: emb.id,
          embedding: emb.embedding,
          metadata: {
            contentType: emb.contentType,
            contentId: emb.contentId,
            ...emb.metadata,
          },
        })),
        limit,
        minSimilarity,
      );

      // Map to RelevantContext format
      return similarities.map((sim) => {
        const embedding = userEmbeddings.find((emb) => emb.id === sim.id);
        return {
          content: embedding?.content || '',
          contentType: (sim.metadata?.contentType || 'resume') as ContentType,
          contentId: sim.metadata?.contentId || '',
          similarity: sim.similarity,
          metadata: sim.metadata,
        };
      });
    } catch (error) {
      this.logger.error('Error finding relevant context', error);
      return [];
    }
  }

  /**
   * Extract relevant skills from past resumes matching job requirements
   */
  async extractRelevantSkills(
    userId: string,
    jobDescription: string,
    costAccumulator?: AiCostAccumulator,
  ): Promise<string[]> {
    const relevantContext = await this.getRelevantContext(
      userId,
      jobDescription,
      5,
      0.6,
      costAccumulator,
    );

    const skills: Set<string> = new Set();

    // Extract skills from relevant resume contexts
    for (const context of relevantContext) {
      if (context.contentType === 'resume') {
        // Parse skills from resume content
        const skillMatches = context.content.match(/Skills?:?\s*([^\n]+)/gi);
        if (skillMatches) {
          skillMatches.forEach((match) => {
            const skillList = match
              .replace(/Skills?:?\s*/i, '')
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            skillList.forEach((skill) => skills.add(skill));
          });
        }
      }
    }

    return Array.from(skills);
  }

  /**
   * Extract relevant work experience matching job requirements
   */
  async extractRelevantExperience(
    userId: string,
    jobDescription: string,
    costAccumulator?: AiCostAccumulator,
  ): Promise<string[]> {
    const relevantContext = await this.getRelevantContext(
      userId,
      jobDescription,
      5,
      0.6,
      costAccumulator,
    );

    const experiences: string[] = [];

    // Extract experience from relevant resume contexts
    for (const context of relevantContext) {
      if (context.contentType === 'resume') {
        // Extract work experience sections
        const expMatches = context.content.match(
          /(?:Job Title|Company|Responsibilities|Achievements):\s*([^\n]+)/gi,
        );
        if (expMatches) {
          experiences.push(...expMatches.map((m) => m.trim()));
        }
      }
    }

    return experiences;
  }

  /**
   * Get writing style from previous documents
   */
  async getWritingStyle(userId: string): Promise<{
    tone?: string;
    style?: string;
    patterns?: string[];
  }> {
    const documents = await this.getAllUserDocuments(userId);
    const profile =
      await this.professionalProfileService.getProfileForGeneration(userId);

    // Extract writing style from persona if available
    const style: {
      tone?: string;
      style?: string;
      patterns?: string[];
    } = {};

    if (profile.persona) {
      style.tone = profile.persona.tone;
      style.style = profile.persona.writingStyle;
      style.patterns = profile.persona.personalityTraits;
    }

    // Could analyze document content for patterns, but for now use persona
    return style;
  }

  /**
   * Build comprehensive context string for AI
   */
  async buildComprehensiveContext(
    userId: string,
    jobDescription?: string,
    costAccumulator?: AiCostAccumulator,
  ): Promise<string> {
    const parts: string[] = [];

    // Get professional profile (basic info, cv metadata, target job)
    const profile =
      await this.professionalProfileService.getProfileForGeneration(userId);

    // Include basic contact info so downstream prompts have the user's name/email/phone
    if (profile.basicInfo && Object.keys(profile.basicInfo).length > 0) {
      const b = profile.basicInfo;
      parts.push('=== BASIC INFO ===');
      if (b.name) parts.push(`Name: ${b.name}`);
      if (b.email) parts.push(`Email: ${b.email}`);
      if (b.phone) parts.push(`Phone: ${b.phone}`);
      const location = [b.city, b.state, b.country].filter(Boolean).join(', ');
      if (location) parts.push(`Location: ${location}`);
      if (b.linkedIn) parts.push(`LinkedIn: ${b.linkedIn}`);
    }

    // Include CV metadata (work history / experience level) for richer context
    if (
      profile.extractedData &&
      Object.keys(profile.extractedData).length > 0
    ) {
      const e = profile.extractedData;
      parts.push('\n=== CAREER BACKGROUND ===');
      if (e.background) parts.push(`Background: ${e.background}`);
      if (e.experience) parts.push(`Experience: ${e.experience}`);
      if (e.skills && e.skills.length > 0)
        parts.push(`Key Skills: ${e.skills.join(', ')}`);
      if (e.achievements && e.achievements.length > 0) {
        parts.push('Key Achievements:');
        e.achievements.forEach((a) => parts.push(`  - ${a}`));
      }
      if (e.education) parts.push(`Education: ${e.education}`);
    }

    // Get all resumes
    const resumes = await this.getAllUserResumes(userId);
    if (resumes.length > 0) {
      parts.push('=== RESUME DATA ===');
      resumes.forEach((resume, index) => {
        parts.push(`\nResume ${index + 1}:`);
        if (resume.contactInfo?.fullName) {
          parts.push(`Name: ${resume.contactInfo.fullName}`);
        }
        if (resume.summary) {
          parts.push(`Summary: ${resume.summary}`);
        }
        if (resume.workExperience && resume.workExperience.length > 0) {
          parts.push('Work Experience:');
          resume.workExperience.forEach((exp) => {
            if (exp.jobTitle)
              parts.push(`  - ${exp.jobTitle} at ${exp.company || 'Unknown'}`);
            if (exp.achievements && exp.achievements.length > 0) {
              exp.achievements.forEach((ach) => parts.push(`    * ${ach}`));
            }
          });
        }
        if (resume.skills) {
          const allSkills: string[] = [];
          if (resume.skills.technical)
            allSkills.push(...resume.skills.technical);
          if (resume.skills.soft) allSkills.push(...resume.skills.soft);
          if (resume.skills.tools) allSkills.push(...resume.skills.tools);
          if (allSkills.length > 0) {
            parts.push(`Skills: ${allSkills.join(', ')}`);
          }
        }
      });
    }

    // Get relevant context if job description provided
    if (jobDescription) {
      const relevantContext = await this.getRelevantContext(
        userId,
        jobDescription,
        10,
        0.5,
        costAccumulator,
      );
      if (relevantContext.length > 0) {
        parts.push('\n=== RELEVANT CONTEXT FROM PAST DOCUMENTS ===');
        relevantContext.forEach((ctx, index) => {
          parts.push(
            `\nRelevant Context ${index + 1} (similarity: ${ctx.similarity.toFixed(2)}):`,
          );
          parts.push(ctx.content.substring(0, 500)); // Limit length
        });
      }
    }

    // Persona & communication style (profile already fetched above)
    if (profile.persona || profile.personaData) {
      parts.push('\n=== PERSONA & COMMUNICATION STYLE ===');
      if (profile.persona) {
        if (profile.persona.communicationStyle) {
          parts.push(
            `Communication Style: ${profile.persona.communicationStyle}`,
          );
        }
        if (profile.persona.tone) {
          parts.push(`Tone: ${profile.persona.tone}`);
        }
        if (profile.persona.professionalVoice) {
          parts.push(
            `Professional Voice: ${profile.persona.professionalVoice}`,
          );
        }
        if (profile.persona.writingStyle) {
          parts.push(`Writing Style: ${profile.persona.writingStyle}`);
        }
      }
      if (profile.personaData?.currentPersona) {
        parts.push(`Current Persona: ${profile.personaData.currentPersona}`);
      }
      if (profile.personaData?.idealPersona) {
        parts.push(`Ideal Persona: ${profile.personaData.idealPersona}`);
      }
    }

    // Get career goals
    if (profile.careerGoals) {
      parts.push('\n=== CAREER GOALS ===');
      if (profile.careerGoals.careerAspirations) {
        parts.push(`Aspirations: ${profile.careerGoals.careerAspirations}`);
      }
      if (
        profile.careerGoals.targetRoles &&
        profile.careerGoals.targetRoles.length > 0
      ) {
        parts.push(
          `Target Roles: ${profile.careerGoals.targetRoles.join(', ')}`,
        );
      }
    }

    return parts.join('\n');
  }
}
