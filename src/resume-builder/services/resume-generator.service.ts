import { Injectable, Logger } from '@nestjs/common';
import { AiChatService, ChatMessage } from './ai-chat.service';
import { MessageRole } from '../enums/message-role.enum';

@Injectable()
export class ResumeGeneratorService {
  private readonly logger = new Logger(ResumeGeneratorService.name);

  constructor(private aiChatService: AiChatService) {}

  /**
   * Generate a resume based on conversation messages
   * This will ask the AI to generate the final resume using all collected information
   */
  async generateResume(messages: ChatMessage[]): Promise<string> {
    try {
      // Create a prompt to generate the resume
      const generatePrompt = `Based on all the information I've provided, please generate my complete ATS-friendly resume now. Use the exact format specified in your instructions.`;

      // Add the generation request to messages
      const messagesWithPrompt: ChatMessage[] = [
        ...messages,
        {
          role: MessageRole.User,
          content: generatePrompt,
        },
      ];

      // Get the AI response (the generated resume)
      const resumeContent = await this.aiChatService.chat(messagesWithPrompt);

      // Extract the resume from the response (AI might add some text before/after)
      const cleanedResume = this.extractResumeContent(resumeContent);

      return cleanedResume;
    } catch (error) {
      this.logger.error('Error generating resume', error);
      throw new Error('Failed to generate resume. Please try again.');
    }
  }

  /**
   * Extract the resume content from AI response
   * The AI might add some conversational text, so we extract just the resume
   */
  private extractResumeContent(aiResponse: string): string {
    // Look for common resume section headers to identify where the resume starts
    const resumeMarkers = [
      'FULL NAME',
      'PROFESSIONAL SUMMARY',
      'WORK EXPERIENCE',
      'EDUCATION',
      'SKILLS',
    ];

    let resumeStartIndex = -1;
    for (const marker of resumeMarkers) {
      const index = aiResponse.indexOf(marker);
      if (index !== -1 && (resumeStartIndex === -1 || index < resumeStartIndex)) {
        resumeStartIndex = index;
      }
    }

    if (resumeStartIndex !== -1) {
      // Extract from the first marker found
      return aiResponse.substring(resumeStartIndex).trim();
    }

    // If no markers found, return the full response
    // The AI should have generated a proper resume
    return aiResponse.trim();
  }

  /**
   * Validate that the resume content follows ATS-friendly format
   */
  validateResumeFormat(resumeContent: string): boolean {
    // Check for forbidden characters/elements
    const forbiddenPatterns = [
      /[📊📈📉🎯✅❌]/g, // Emojis
      /<table|<div|<span|<img/i, // HTML tags
      /│|┌|┐|└|┘|├|┤|┬|┴/g, // Box drawing characters
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(resumeContent)) {
        return false;
      }
    }

    // Check that it has at least some expected sections
    const hasName = /^[A-Z\s]+$/m.test(resumeContent.split('\n')[0]?.trim() || '');
    const hasSections = /(WORK EXPERIENCE|EDUCATION|SKILLS|PROFESSIONAL SUMMARY)/i.test(resumeContent);

    return hasName || hasSections;
  }
}

