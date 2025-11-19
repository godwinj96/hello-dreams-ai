import { Injectable, Logger } from '@nestjs/common';
import { AiChatService, ChatMessage } from '../../resume-builder/services/ai-chat.service';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';
import { DocumentType } from '../enums/document-type.enum';
import { ProfessionalProfileService } from '../../professional-profile/professional-profile.service';

@Injectable()
export class DocumentGeneratorService {
  private readonly logger = new Logger(DocumentGeneratorService.name);

  constructor(
    private aiChatService: AiChatService,
    private professionalProfileService: ProfessionalProfileService,
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
  ): Promise<string> {
    try {
      // Get professional profile data
      const profile = await this.professionalProfileService.getProfileForGeneration(userId);

      // Build context from profile
      const profileContext = this.buildProfileContext(profile);

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
      const documentContent = await this.aiChatService.chat(messagesWithPrompt);

      // Extract the document from the response
      const cleanedDocument = this.extractDocumentContent(documentContent, documentType);

      return cleanedDocument;
    } catch (error) {
      this.logger.error('Error generating document', error);
      throw new Error(`Failed to generate ${documentType}. Please try again.`);
    }
  }

  private buildProfileContext(profile: any): string {
    let context = '';

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
    }

    if (profile.extractedData) {
      if (profile.extractedData.background) {
        context += `Background: ${profile.extractedData.background}\n`;
      }
      if (profile.extractedData.skills?.length > 0) {
        context += `Skills: ${profile.extractedData.skills.join(', ')}\n`;
      }
    }

    return context;
  }

  private getGenerationPrompt(
    documentType: DocumentType,
    profileContext: string,
    targetJobTitle?: string,
    targetCompany?: string,
    jobDescription?: string,
  ): string {
    if (documentType === DocumentType.CoverLetter) {
      return `Based on all the information I've provided and the following context about my professional profile:

${profileContext}

${targetJobTitle ? `Target Job Title: ${targetJobTitle}` : ''}
${targetCompany ? `Target Company: ${targetCompany}` : ''}
${jobDescription ? `Job Description:\n${jobDescription}` : ''}

Please generate my complete cover letter now. Use the exact tone and style specified in my persona preferences. Make it personalized, compelling, and tailored to the position.`;
    } else {
      return `Based on all the information I've provided and the following context about my professional profile:

${profileContext}

Please generate my complete personal statement now. Use the exact tone and style specified in my persona preferences. Make it authentic, compelling, and reflective of my career journey and aspirations.`;
    }
  }

  private extractDocumentContent(aiResponse: string, documentType: DocumentType): string {
    // Look for common document markers
    const markers = documentType === DocumentType.CoverLetter
      ? ['Dear', 'To Whom It May Concern', 'Hiring Manager', 'Sincerely', 'Best regards']
      : ['Personal Statement', 'Statement of Purpose', 'Introduction'];

    let documentStartIndex = -1;
    for (const marker of markers) {
      const index = aiResponse.indexOf(marker);
      if (index !== -1 && (documentStartIndex === -1 || index < documentStartIndex)) {
        documentStartIndex = index;
      }
    }

    if (documentStartIndex !== -1) {
      return aiResponse.substring(documentStartIndex).trim();
    }

    // If no markers found, return the full response
    return aiResponse.trim();
  }
}

