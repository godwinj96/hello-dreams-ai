import { Injectable, Logger } from '@nestjs/common';
import { ProfessionalProfileService } from '../../professional-profile/professional-profile.service';
import { ChatMessage } from '../../resume-builder/services/ai-chat.service';

@Injectable()
export class CareerProfileExtractorService {
  private readonly logger = new Logger(CareerProfileExtractorService.name);

  constructor(
    private professionalProfileService: ProfessionalProfileService,
  ) {}

  /**
   * Extract structured data from conversation and update professional profile
   */
  async extractAndUpdateProfile(
    userId: string,
    messages: ChatMessage[],
  ): Promise<void> {
    try {
      // Get the full conversation text
      const conversationText = messages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Extract key information using pattern matching and AI analysis
      const extractedData = this.extractStructuredData(conversationText);

      // Update professional profile
      await this.professionalProfileService.updateExtractedData(
        userId,
        extractedData,
      );

      // Extract career goals if mentioned
      const careerGoals = this.extractCareerGoals(conversationText);
      if (Object.keys(careerGoals).length > 0) {
        await this.professionalProfileService.updateCareerGoals(
          userId,
          careerGoals,
        );
      }
    } catch (error) {
      this.logger.error('Error extracting profile data', error);
      // Don't throw - extraction is best effort
    }
  }

  /**
   * Extract structured data from conversation text
   */
  private extractStructuredData(conversationText: string): any {
    const extracted: any = {};

    // Extract background/experience mentions
    const experiencePatterns = [
      /(?:experience|worked|job|role|position).*?(\d+)\s*(?:years?|months?)/i,
      /(?:background|experience).*?([^.!?]+)/i,
    ];

    // Extract skills mentions
    const skillsPattern = /(?:skills?|proficient|expert|knowledge).*?([^.!?]+)/gi;
    const skillsMatches = conversationText.match(skillsPattern);
    if (skillsMatches) {
      extracted.skills = skillsMatches
        .map((match) => match.replace(/skills?|proficient|expert|knowledge/gi, '').trim())
        .filter((s) => s.length > 0);
    }

    // Extract achievements mentions
    const achievementPattern = /(?:achieved|accomplished|award|recognition|success).*?([^.!?]+)/gi;
    const achievementMatches = conversationText.match(achievementPattern);
    if (achievementMatches) {
      extracted.achievements = achievementMatches
        .map((match) => match.trim())
        .filter((a) => a.length > 0);
    }

    // Extract education mentions
    const educationPattern = /(?:education|degree|university|college|graduated).*?([^.!?]+)/gi;
    const educationMatches = conversationText.match(educationPattern);
    if (educationMatches) {
      extracted.education = educationMatches
        .map((match) => match.trim())
        .filter((e) => e.length > 0)
        .join(' ');
    }

    return extracted;
  }

  /**
   * Extract career goals from conversation
   */
  private extractCareerGoals(conversationText: string): any {
    const goals: any = {};

    // Extract target roles
    const rolePattern = /(?:target|want|aspire|goal).*?(?:role|position|job|title).*?([^.!?]+)/gi;
    const roleMatches = conversationText.match(rolePattern);
    if (roleMatches) {
      goals.targetRoles = roleMatches
        .map((match) => match.replace(/target|want|aspire|goal|role|position|job|title/gi, '').trim())
        .filter((r) => r.length > 0);
    }

    // Extract target industries
    const industryPattern = /(?:industry|sector|field).*?([^.!?]+)/gi;
    const industryMatches = conversationText.match(industryPattern);
    if (industryMatches) {
      goals.targetIndustries = industryMatches
        .map((match) => match.replace(/industry|sector|field/gi, '').trim())
        .filter((i) => i.length > 0);
    }

    // Extract career aspirations
    const aspirationPattern = /(?:aspiration|dream|goal|vision|future).*?([^.!?]+)/gi;
    const aspirationMatches = conversationText.match(aspirationPattern);
    if (aspirationMatches) {
      goals.careerAspirations = aspirationMatches
        .map((match) => match.trim())
        .join(' ');
    }

    return goals;
  }
}

