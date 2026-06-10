import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../../shared/services/openai.service';
import { ResumeData } from '../../resume-builder/entities/resume-data.entity';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';
import { AiCostAccumulator } from '../../shared/utils/ai-cost-accumulator';
import { openAIChatAndTrack } from '../../shared/utils/ai-usage.helpers';

export interface LinkedInSections {
  headline: {
    options: string[];
    selected?: string;
  };
  about: string;
  topSkills: string[];
  experience: Array<{
    jobTitle: string;
    company: string;
    dates?: string;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    dates?: string;
  }>;
  certifications: Array<{
    name: string;
    issuingOrganization?: string;
    date?: string;
  }>;
  skills: string[];
  volunteering?: Array<{
    organization: string;
    role: string;
    description?: string;
  }>;
}

@Injectable()
export class LinkedInContentService {
  private readonly logger = new Logger(LinkedInContentService.name);

  constructor(private openAIService: OpenAIService) {}

  /**
   * Generate all LinkedIn sections from resume data
   */
  async generateLinkedInProfile(
    resumeData: ResumeData | null,
    costAccumulator?: AiCostAccumulator,
  ): Promise<LinkedInSections> {
    try {
      const headline = await this.generateHeadline(resumeData, costAccumulator);
      const about = await this.generateAbout(resumeData, costAccumulator);
      const topSkills = this.extractTopSkills(resumeData, 6);
      const experience = this.generateExperience(resumeData);
      const education = this.generateEducation(resumeData);
      const certifications = this.generateCertifications(resumeData);
      const skills = this.extractAllSkills(resumeData);
      const volunteering = this.extractVolunteering(resumeData);

      return {
        headline,
        about,
        topSkills,
        experience,
        education,
        certifications,
        skills,
        volunteering,
      };
    } catch (error) {
      this.logger.error('Error generating LinkedIn profile', error);
      throw error;
    }
  }

  /**
   * Generate headline (2-3 options)
   */
  private async generateHeadline(
    resumeData: ResumeData | null,
    costAccumulator?: AiCostAccumulator,
  ): Promise<{
    options: string[];
    selected?: string;
  }> {
    if (!resumeData) {
      return {
        options: ['Professional', 'Career Professional'],
      };
    }

    const jobTitle = resumeData.contactInfo?.linkedIn?.split('/').pop() || 
                    resumeData.workExperience?.[0]?.jobTitle || 
                    'Professional';
    
    const summary = resumeData.summary || '';
    const skills = this.extractTopSkills(resumeData, 3).join(', ');

    const prompt = `Generate 2-3 professional LinkedIn headline options. Each headline should follow this format:
Role Title (could be 2 or more, e.g., "Product Design || UX Researcher || Founder") + Key Value or Impact + Industry or Tools (optional). Separate sections with ( || ).

Current role: ${jobTitle}
Summary: ${summary.substring(0, 200)}
Top skills: ${skills}

Generate 2-3 headline options. Return as a JSON array of strings.`;

    try {
      const response = await openAIChatAndTrack(
        this.openAIService,
        [
          { role: MessageRole.System, content: 'You are a LinkedIn profile optimizer.' },
          { role: MessageRole.User, content: prompt },
        ],
        costAccumulator,
      );

      // Try to extract JSON array
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const options = JSON.parse(jsonMatch[0]);
        return {
          options: Array.isArray(options) ? options : [options],
          selected: options[0],
        };
      }

      // Fallback: split by newlines
      const options = response.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+[.)]\s*/, '').trim())
        .slice(0, 3);

      return {
        options: options.length > 0 ? options : [jobTitle],
        selected: options[0],
      };
    } catch (error) {
      this.logger.error('Error generating headline', error);
      return {
        options: [jobTitle],
        selected: jobTitle,
      };
    }
  }

  /**
   * Generate About section
   */
  private async generateAbout(
    resumeData: ResumeData | null,
    costAccumulator?: AiCostAccumulator,
  ): Promise<string> {
    if (!resumeData) {
      return 'Professional seeking new opportunities.';
    }

    const summary = resumeData.summary || '';
    const workExperience = resumeData.workExperience || [];
    const yearsExperience = this.calculateYearsExperience(workExperience);
    const topAchievements = this.extractTopAchievements(resumeData, 2);
    const skills = this.extractTopSkills(resumeData, 5).join(', ');

    const prompt = `Write a professional LinkedIn "About" section following this structure:
1. Opening Line: Who they are, years of experience, their domain
2. What they're great at: Pull top strengths
3. Impact: 2-3 measurable achievements
4. Industry experience / tools
5. Career goals (optional)

Summary: ${summary}
Years of experience: ${yearsExperience}
Top achievements: ${topAchievements.join('; ')}
Skills: ${skills}

Write in a confident, warm, straightforward tone. No clichés. 3-4 paragraphs max.`;

    try {
      const response = await openAIChatAndTrack(
        this.openAIService,
        [
          { role: MessageRole.System, content: 'You are a LinkedIn profile optimizer.' },
          { role: MessageRole.User, content: prompt },
        ],
        costAccumulator,
      );

      return response.trim();
    } catch (error) {
      this.logger.error('Error generating About section', error);
      return summary || 'Professional with expertise in delivering impactful results.';
    }
  }

  /**
   * Extract top skills (6-10 for top skills, 15-20 for full list)
   */
  private extractTopSkills(resumeData: ResumeData | null, limit: number = 10): string[] {
    if (!resumeData || !resumeData.skills) return [];

    const skills: string[] = [];
    if (resumeData.skills.technical) skills.push(...resumeData.skills.technical);
    if (resumeData.skills.tools) skills.push(...resumeData.skills.tools);
    if (resumeData.skills.soft) skills.push(...resumeData.skills.soft);

    return skills.slice(0, limit);
  }

  /**
   * Extract all skills (15-20)
   */
  private extractAllSkills(resumeData: ResumeData | null): string[] {
    return this.extractTopSkills(resumeData, 20);
  }

  /**
   * Generate experience section (LinkedIn format)
   */
  private generateExperience(resumeData: ResumeData | null): Array<{
    jobTitle: string;
    company: string;
    dates?: string;
    bullets: string[];
  }> {
    if (!resumeData || !resumeData.workExperience) return [];

    return resumeData.workExperience.map((role) => {
      const dates = `${role.startDate}${role.endDate ? ` – ${role.endDate}` : ' – Present'}`;
      const bullets = role.achievements?.slice(0, 4) || role.responsibilities?.slice(0, 4) || [];

      return {
        jobTitle: role.jobTitle,
        company: role.company,
        dates,
        bullets: bullets.map(b => b.replace(/^[-•*]\s*/, '')), // Remove bullet markers
      };
    });
  }

  /**
   * Generate education section
   */
  private generateEducation(resumeData: ResumeData | null): Array<{
    degree: string;
    institution: string;
    dates?: string;
  }> {
    if (!resumeData || !resumeData.education) return [];

    return resumeData.education.map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      dates: edu.graduationYear ? `${edu.graduationYear}` : undefined,
    }));
  }

  /**
   * Generate certifications section
   */
  private generateCertifications(resumeData: ResumeData | null): Array<{
    name: string;
    issuingOrganization?: string;
    date?: string;
  }> {
    if (!resumeData || !resumeData.certifications) return [];

    return resumeData.certifications.map((cert) => ({
      name: cert.name,
      issuingOrganization: cert.issuingOrganization,
      date: cert.date,
    }));
  }

  /**
   * Extract volunteering experience
   */
  private extractVolunteering(resumeData: ResumeData | null): Array<{
    organization: string;
    role: string;
    description?: string;
  }> {
    // This would come from projects or a dedicated field
    // For now, return empty array
    return [];
  }

  /**
   * Extract top achievements
   */
  private extractTopAchievements(resumeData: ResumeData | null, limit: number): string[] {
    if (!resumeData) return [];

    const achievements: string[] = [];
    
    if (resumeData.keyAchievements) {
      achievements.push(...resumeData.keyAchievements);
    }

    if (resumeData.workExperience) {
      resumeData.workExperience.forEach((role) => {
        if (role.achievements) {
          achievements.push(...role.achievements);
        }
      });
    }

    return achievements.slice(0, limit);
  }

  /**
   * Calculate years of experience
   */
  private calculateYearsExperience(workExperience: ResumeData['workExperience']): number {
    if (!workExperience || workExperience.length === 0) return 0;

    const now = new Date();
    let totalMonths = 0;

    for (const job of workExperience) {
      const start = job.startDate ? new Date(job.startDate) : null;
      const end = job.endDate ? new Date(job.endDate) : now;

      if (!start || isNaN(start.getTime())) continue;
      if (isNaN(end.getTime())) continue;

      const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());

      if (months > 0) totalMonths += months;
    }

    return Math.round(totalMonths / 12);
  }
}














