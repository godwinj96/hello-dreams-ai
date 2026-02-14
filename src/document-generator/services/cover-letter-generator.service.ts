import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAIService } from '../../shared/services/openai.service';
import { JobDescriptionParserService, ParsedJobDescription } from './job-description-parser.service';
import { ResumeData } from '../../resume-builder/entities/resume-data.entity';
import { Resume } from '../../resume-builder/entities/resume.entity';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';
import { PromptInjectionGuardService } from '../../shared/services/prompt-injection-guard.service';
import { UserContextService } from './user-context.service';

export interface CoverLetterSections {
  header: {
    name: string;
    title?: string;
    phone: string;
    email: string;
    linkedIn?: string;
    location?: string;
  };
  companyAddress: {
    hiringManager: string;
    companyName: string;
    location?: string;
  };
  opening: string;
  core: string;
  skillsMatch: string;
  culturalFit: string;
  closing: string;
  signature: string;
}

@Injectable()
export class CoverLetterGeneratorService {
  private readonly logger = new Logger(CoverLetterGeneratorService.name);

  constructor(
    private openAIService: OpenAIService,
    private jobDescriptionParser: JobDescriptionParserService,
    @InjectRepository(ResumeData)
    private resumeDataRepository: Repository<ResumeData>,
    @InjectRepository(Resume)
    private resumeRepository: Repository<Resume>,
    private promptInjectionGuard: PromptInjectionGuardService,
    private userContextService: UserContextService,
  ) {}

  /**
   * Generate cover letter with 7-section structure
   */
  async generateCoverLetter(
    userId: string,
    jobDescription?: string,
    targetJobTitle?: string,
    targetCompany?: string,
  ): Promise<string> {
    try {
      // Parse job description if provided (sanitize first)
      let parsedJobDescription: ParsedJobDescription | null = null;
      if (jobDescription) {
        const sanitizedJobDescription = this.promptInjectionGuard.sanitizeJobDescription(jobDescription);
        parsedJobDescription = await this.jobDescriptionParser.parseJobDescription(sanitizedJobDescription);
      }

      // Get comprehensive context from all user data
      const comprehensiveContext = await this.userContextService.buildComprehensiveContext(
        userId,
        jobDescription,
      );

      // Get user's resume data (latest resume) - still needed for structured data
      const resumeData = await this.getLatestResumeData(userId);

      // Get all resumes for comprehensive skill/experience extraction
      const allResumes = await this.userContextService.getAllUserResumes(userId);

      // Get user's basic info from profile
      // This will be injected via the main service

      // Generate sections with comprehensive context
      const sections = await this.generateSections(
        resumeData,
        parsedJobDescription,
        targetJobTitle || parsedJobDescription?.jobTitle,
        targetCompany || parsedJobDescription?.companyName,
        comprehensiveContext,
        allResumes,
      );

      // Format into complete cover letter
      return this.formatCoverLetter(sections);
    } catch (error) {
      this.logger.error('Error generating cover letter', error);
      throw error;
    }
  }

  /**
   * Get latest resume data for user
   */
  private async getLatestResumeData(userId: string): Promise<ResumeData | null> {
    // Find latest resume for user
    const latestResume = await this.resumeRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (!latestResume) {
      return null;
    }

    // Get resume data
    const resumeData = await this.resumeDataRepository.findOne({
      where: { resumeId: latestResume.id },
    });

    return resumeData;
  }

  /**
   * Generate all cover letter sections
   */
  private async generateSections(
    resumeData: ResumeData | null,
    parsedJobDescription: ParsedJobDescription | null,
    targetJobTitle?: string,
    targetCompany?: string,
    comprehensiveContext?: string,
    allResumes?: ResumeData[],
  ): Promise<CoverLetterSections> {
    // Extract key achievements from all resumes
    const achievements = this.extractAchievementsFromAllResumes(allResumes || (resumeData ? [resumeData] : []));
    const topSkills = this.extractTopSkillsFromAllResumes(allResumes || (resumeData ? [resumeData] : []));
    const experience = resumeData?.workExperience || [];

    // Generate header
    const header = {
      name: resumeData?.contactInfo?.fullName || 'Your Name',
      title: targetJobTitle || resumeData?.contactInfo?.linkedIn || undefined,
      phone: resumeData?.contactInfo?.phone || '',
      email: resumeData?.contactInfo?.email || '',
      linkedIn: resumeData?.contactInfo?.linkedIn,
      location: resumeData?.contactInfo?.location,
    };

    // Generate company address
    const companyAddress = {
      hiringManager: 'Hiring Manager',
      companyName: targetCompany || parsedJobDescription?.companyName || '[Company Name]',
      location: parsedJobDescription?.location,
    };

    // Generate opening paragraph with comprehensive context
    const opening = await this.generateOpening(
      header.name,
      targetJobTitle || parsedJobDescription?.jobTitle || 'the position',
      targetCompany || parsedJobDescription?.companyName || 'your organization',
      experience.length,
      comprehensiveContext,
    );

    // Generate core paragraph (2-3 top achievements) with context
    const core = await this.generateCoreParagraph(
      achievements.slice(0, 3),
      parsedJobDescription?.keyResponsibilities || [],
      comprehensiveContext,
    );

    // Generate skills match paragraph
    const skillsMatch = await this.generateSkillsMatchParagraph(
      topSkills,
      parsedJobDescription?.requiredSkills || [],
      parsedJobDescription?.requiredTools || [],
    );

    // Generate cultural fit paragraph
    const culturalFit = await this.generateCulturalFitParagraph(
      targetCompany || parsedJobDescription?.companyName,
    );

    // Generate closing paragraph
    const closing = await this.generateClosingParagraph(
      parsedJobDescription?.toneStyle || 'formal',
    );

    // Generate signature
    const signature = header.name;

    return {
      header,
      companyAddress,
      opening,
      core,
      skillsMatch,
      culturalFit,
      closing,
      signature,
    };
  }

  /**
   * Extract achievements from all resumes
   */
  private extractAchievementsFromAllResumes(resumes: ResumeData[]): string[] {
    if (resumes.length === 0) return [];

    const achievements: string[] = [];

    resumes.forEach((resume) => {
      // Extract from work experience
      if (resume.workExperience) {
        resume.workExperience.forEach((role) => {
          if (role.achievements) {
            achievements.push(...role.achievements);
          }
        });
      }

      // Extract from key achievements section
      if (resume.keyAchievements) {
        achievements.push(...resume.keyAchievements);
      }
    });

    return achievements.filter(Boolean);
  }

  /**
   * Extract top skills from all resumes
   */
  private extractTopSkillsFromAllResumes(resumes: ResumeData[]): string[] {
    if (resumes.length === 0) return [];

    const skills: Set<string> = new Set();

    resumes.forEach((resume) => {
      if (resume.skills) {
        if (resume.skills.technical) resume.skills.technical.forEach(s => skills.add(s));
        if (resume.skills.tools) resume.skills.tools.forEach(s => skills.add(s));
        if (resume.skills.soft) resume.skills.soft.forEach(s => skills.add(s));
      }
    });

    return Array.from(skills);
  }

  /**
   * Generate opening paragraph
   */
  private async generateOpening(
    name: string,
    jobTitle: string,
    companyName: string,
    yearsExperience: number,
    comprehensiveContext?: string,
  ): Promise<string> {
    const contextSection = comprehensiveContext 
      ? `\n\nAdditional context about the candidate:\n${comprehensiveContext.substring(0, 1000)}`
      : '';

    const prompt = `Write a strong opening paragraph for a cover letter. The candidate is ${name} with approximately ${yearsExperience} years of experience. They are applying for the ${jobTitle} position at ${companyName}.${contextSection}

The opening should:
- Mention the role and company
- State a clear value proposition
- Anchor on relevance (years of experience or key expertise)
- Immediately position the candidate as someone worth reading
- Reflect the candidate's communication style and professional voice from their persona

Write only the opening paragraph (2-3 sentences). Use confident, professional language.`;

    const response = await this.openAIService.chat([
      { role: MessageRole.System, content: 'You are a professional cover letter writer.' },
      { role: MessageRole.User, content: prompt },
    ]);

    return response.trim();
  }

  /**
   * Generate core paragraph with achievements
   */
  private async generateCoreParagraph(
    achievements: string[],
    jobResponsibilities: string[],
    comprehensiveContext?: string,
  ): Promise<string> {
    if (achievements.length === 0) {
      return 'I bring a strong track record of delivering impactful results and driving success in challenging environments.';
    }

    const contextSection = comprehensiveContext 
      ? `\n\nAdditional context about the candidate's background and experience:\n${comprehensiveContext.substring(0, 800)}`
      : '';

    const prompt = `Write a core paragraph for a cover letter that presents 2-3 key achievements as evidence of fit. 

Achievements to highlight:
${achievements.map((a, i) => `${i + 1}. ${a}`).join('\n')}

${jobResponsibilities.length > 0 ? `\nKey job responsibilities to align with:\n${jobResponsibilities.slice(0, 3).join('\n')}` : ''}${contextSection}

Write 1-2 sentences per achievement. Keep it confident and executive-level, not soft. Focus on measurable impact. Match the candidate's communication style from their persona.`;

    const response = await this.openAIService.chat([
      { role: MessageRole.System, content: 'You are a professional cover letter writer.' },
      { role: MessageRole.User, content: prompt },
    ]);

    return response.trim();
  }

  /**
   * Generate skills match paragraph
   */
  private async generateSkillsMatchParagraph(
    candidateSkills: string[],
    requiredSkills: string[],
    requiredTools: string[],
  ): Promise<string> {
    const matchingSkills = candidateSkills.filter(skill =>
      requiredSkills.some(req => req.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(req.toLowerCase()))
    );

    if (matchingSkills.length === 0 && requiredSkills.length === 0) {
      return 'My technical expertise and professional experience align well with the requirements of this role.';
    }

    const prompt = `Write a brief paragraph (2-3 sentences) mapping the candidate's skills to the job requirements. Make it sound natural, not like keyword stuffing.

Candidate's skills: ${candidateSkills.slice(0, 5).join(', ')}
Required skills: ${requiredSkills.slice(0, 5).join(', ')}
${requiredTools.length > 0 ? `Required tools: ${requiredTools.slice(0, 5).join(', ')}` : ''}

Mention 3-5 matching skills/tools in a natural way.`;

    const response = await this.openAIService.chat([
      { role: MessageRole.System, content: 'You are a professional cover letter writer.' },
      { role: MessageRole.User, content: prompt },
    ]);

    return response.trim();
  }

  /**
   * Generate cultural fit paragraph
   */
  private async generateCulturalFitParagraph(companyName?: string): Promise<string> {
    const prompt = `Write 1 sentence about why the candidate is excited about ${companyName || 'this opportunity'} and what excites them about the mission/company. Keep it brief and authentic.`;

    const response = await this.openAIService.chat([
      { role: MessageRole.System, content: 'You are a professional cover letter writer.' },
      { role: MessageRole.User, content: prompt },
    ]);

    return response.trim();
  }

  /**
   * Generate closing paragraph
   */
  private async generateClosingParagraph(toneStyle: string): Promise<string> {
    const prompt = `Write a strong closing paragraph for a cover letter. The tone should be ${toneStyle}. 

The closing should:
- Be confident, not desperate
- Not be gimmicky
- Include a confident call to action
- Be 2-3 sentences

Write only the closing paragraph.`;

    const response = await this.openAIService.chat([
      { role: MessageRole.System, content: 'You are a professional cover letter writer.' },
      { role: MessageRole.User, content: prompt },
    ]);

    return response.trim();
  }

  /**
   * Format cover letter into final structure
   */
  private formatCoverLetter(sections: CoverLetterSections): string {
    let letter = '';

    // Header
    letter += `${sections.header.name}\n`;
    if (sections.header.title) {
      letter += `${sections.header.title}\n`;
    }
    letter += `${sections.header.phone}\n`;
    letter += `${sections.header.email}\n`;
    if (sections.header.linkedIn) {
      letter += `${sections.header.linkedIn}\n`;
    }
    if (sections.header.location) {
      letter += `${sections.header.location}\n`;
    }
    letter += '\n';

    // Company Address
    letter += `${sections.companyAddress.hiringManager}\n`;
    letter += `${sections.companyAddress.companyName}\n`;
    if (sections.companyAddress.location) {
      letter += `${sections.companyAddress.location}\n`;
    }
    letter += '\n';

    // Opening
    letter += `${sections.opening}\n\n`;

    // Core
    letter += `${sections.core}\n\n`;

    // Skills Match
    letter += `${sections.skillsMatch}\n\n`;

    // Cultural Fit
    letter += `${sections.culturalFit}\n\n`;

    // Closing
    letter += `${sections.closing}\n\n`;

    // Signature
    letter += `Warm regards,\n${sections.signature}`;

    return letter;
  }
}











