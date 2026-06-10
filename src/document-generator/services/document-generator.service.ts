import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AiChatService, ChatMessage } from '../../resume-builder/services/ai-chat.service';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';
import { DocumentType } from '../enums/document-type.enum';
import { ProfessionalProfileService } from '../../professional-profile/professional-profile.service';
import { CoverLetterGeneratorService } from './cover-letter-generator.service';
import { JobDescriptionParserService } from './job-description-parser.service';
import { buildJsonOnlyInstruction, parseJsonObject } from '../../shared/utils/json-llm.util';
import { UserContextService } from './user-context.service';
import { AiCostAccumulator } from '../../shared/utils/ai-cost-accumulator';

export interface StructuredDocumentJson {
  documentType: DocumentType | string;
  meta?: {
    targetRole?: string;
    targetCompany?: string;
    jobDescriptionSummary?: string;
    tone?: string;
    sender?: {
      name?: string;
      email?: string;
      phone?: string;
      location?: string;
    };
  };
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
  closing?: {
    signoff?: string;
    signature?: string;
  };
}

@Injectable()
export class DocumentGeneratorService {
  private readonly logger = new Logger(DocumentGeneratorService.name);

  constructor(
    private aiChatService: AiChatService,
    private professionalProfileService: ProfessionalProfileService,
    private coverLetterGenerator: CoverLetterGeneratorService,
    private jobDescriptionParser: JobDescriptionParserService,
    private userContextService: UserContextService,
  ) {}

  /**
   * Generate a cover letter or personal statement based on conversation messages
   */
  async generateDocument(
    messages: ChatMessage[],
    documentType: DocumentType,
    userId: string,
    targetJobTitle?: string,
    targetCompany?: string,
    jobDescription?: string,
    costAccumulator?: AiCostAccumulator,
  ): Promise<StructuredDocumentJson> {
    try {
      // For cover letters, use the structured sections generator to avoid
      // embedding header/footer in the paragraph text (which causes duplicates
      // when the frontend template also renders the sender block and signature).
      if (documentType === DocumentType.CoverLetter) {
        const coverSections = await this.coverLetterGenerator.generateCoverLetterSections(
          userId,
          jobDescription,
          targetJobTitle,
          targetCompany,
          costAccumulator,
        );
        return {
          documentType,
          meta: {
            targetRole: targetJobTitle || coverSections.companyAddress.companyName,
            targetCompany: targetCompany || coverSections.companyAddress.companyName,
            jobDescriptionSummary: jobDescription?.slice(0, 140),
            sender: {
              name: coverSections.header.name,
              email: coverSections.header.email,
              phone: coverSections.header.phone,
              location: coverSections.header.location,
            },
          },
          sections: [
            { heading: 'Opening', paragraphs: [coverSections.opening] },
            { heading: 'Core', paragraphs: [coverSections.core] },
            { heading: 'Skills', paragraphs: [coverSections.skillsMatch] },
            { heading: 'Cultural Fit', paragraphs: [coverSections.culturalFit] },
            { heading: 'Closing', paragraphs: [coverSections.closing] },
          ],
          closing: { signoff: 'Warm regards', signature: coverSections.signature },
        };
      }

      // For personal statements, use the existing flow
      // Get comprehensive context including all user data
      const comprehensiveContext = await this.userContextService.buildComprehensiveContext(
        userId,
        jobDescription,
      );

      // Get professional profile data
      const profile = await this.professionalProfileService.getProfileForGeneration(userId);

      // Build context from profile (enhanced with comprehensive context)
      const profileContext = this.buildProfileContext(profile, comprehensiveContext);

      // Create generation prompt based on document type
      const generatePrompt = this.getGenerationPrompt(
        documentType,
        profileContext,
        targetJobTitle,
        targetCompany,
        jobDescription,
      );

      // Add the generation request to messages
      const messagesWithPrompt: ChatMessage[] = [
        ...messages,
        {
          role: MessageRole.User,
          content: generatePrompt,
        },
      ];

      // Get the AI response (the generated document)
      const draftResult = await this.aiChatService.chatWithUsage(messagesWithPrompt);
      if (costAccumulator) {
        costAccumulator.addChat({
          operation: 'chat',
          provider: draftResult.provider,
          model: draftResult.model,
          usage: draftResult.usage,
          estimated: draftResult.provider !== 'openai',
        });
      }
      const documentContent = draftResult.content;

      const schemaDescription = `
Top-level JSON object:
- documentType: "${documentType}"
- meta: object { targetRole?, targetCompany?, jobDescriptionSummary?, tone? }
- sections: array of objects { heading: string, paragraphs?: string[], bullets?: string[] }
- closing: object { signoff?, signature? }
Return ONLY JSON.`;

      const example: StructuredDocumentJson = {
        documentType,
        meta: {
          targetRole: targetJobTitle,
          targetCompany,
          jobDescriptionSummary: jobDescription?.slice(0, 140),
        },
        sections: [
          { heading: 'Opening', paragraphs: ['Dear Hiring Manager, ...'] },
          {
            heading: 'Body',
            paragraphs: [
              'I led...',
              'I improved...',
            ],
          },
          { heading: 'Closing', paragraphs: ['Thank you for your time.'] },
        ],
        closing: { signoff: 'Sincerely', signature: 'Jane Doe' },
      };

      const instruction = buildJsonOnlyInstruction(schemaDescription, example);
      const structuredResult = await this.aiChatService.chatWithUsage([
        { role: MessageRole.System, content: instruction },
        ...messagesWithPrompt,
        {
          role: MessageRole.User,
          content: 'Return the document as JSON only using the schema.',
        },
      ]);
      if (costAccumulator) {
        costAccumulator.addChat({
          operation: 'chat',
          provider: structuredResult.provider,
          model: structuredResult.model,
          usage: structuredResult.usage,
          estimated: structuredResult.provider !== 'openai',
        });
      }
      const structuredResponse = structuredResult.content;

      const parsed = parseJsonObject<StructuredDocumentJson>(structuredResponse);
      if (!parsed.ok || !parsed.data) {
        throw new BadRequestException(parsed.error || 'Invalid JSON from model.');
      }

      return parsed.data;
    } catch (error) {
      this.logger.error('Error generating document', error);
      throw new Error(`Failed to generate ${documentType}. Please try again.`);
    }
  }

  private buildProfileContext(profile: any, comprehensiveContext?: string): string {
    let context = '';

    // Add comprehensive context first (includes all resumes, documents, persona)
    if (comprehensiveContext) {
      context += `=== COMPREHENSIVE USER CONTEXT ===\n${comprehensiveContext}\n\n`;
    }

    if (profile.careerGoals) {
      if (profile.careerGoals.targetRoles?.length > 0) {
        context += `Target Roles: ${profile.careerGoals.targetRoles.join(', ')}\n`;
      }
      if (profile.careerGoals.careerAspirations) {
        context += `Career Aspirations: ${profile.careerGoals.careerAspirations}\n`;
      }
    }

    if (profile.persona) {
      if (profile.persona.communicationStyle) {
        context += `Communication Style: ${profile.persona.communicationStyle}\n`;
      }
      if (profile.persona.tone) {
        context += `Preferred Tone: ${profile.persona.tone}\n`;
      }
      if (profile.persona.professionalVoice) {
        context += `Professional Voice: ${profile.persona.professionalVoice}\n`;
      }
      if (profile.persona.writingStyle) {
        context += `Writing Style: ${profile.persona.writingStyle}\n`;
      }
    }

    if (profile.extractedData) {
      if (profile.extractedData.background) {
        context += `Background: ${profile.extractedData.background}\n`;
      }
      if (profile.extractedData.skills?.length > 0) {
        context += `Skills: ${profile.extractedData.skills.join(', ')}\n`;
      }
      if (profile.extractedData.achievements?.length > 0) {
        context += `Key Achievements: ${profile.extractedData.achievements.join(', ')}\n`;
      }
    }

    // Add previous document excerpts for style consistency
    // This will be handled by comprehensiveContext which includes relevant past documents

    return context;
  }

  private getGenerationPrompt(
    documentType: DocumentType,
    profileContext: string,
    targetJobTitle?: string,
    targetCompany?: string,
    jobDescription?: string,
  ): string {
    return `Based on all the information I've provided and the following context about my professional profile:

${profileContext}

${targetJobTitle ? `Target Job Title: ${targetJobTitle}` : ''}
${targetCompany ? `Target Company: ${targetCompany}` : ''}
${jobDescription ? `Job Description:\n${jobDescription}` : ''}

Generate a complete ${documentType === DocumentType.CoverLetter ? 'cover letter' : 'personal statement'} now. Ensure the response is concise and structured.`;
  }
}

