import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../../shared/services/openai.service';
import { AiCostAccumulator } from '../../shared/utils/ai-cost-accumulator';
import { addExtractionUsageToAccumulator } from '../../shared/utils/ai-usage.helpers';

export interface ParsedJobDescription {
  jobTitle: string;
  companyName: string;
  requiredSkills: string[];
  requiredTools: string[];
  keyResponsibilities: string[];
  preferredExperience: string;
  toneStyle:
    | 'formal'
    | 'corporate'
    | 'creative'
    | 'startup'
    | 'friendly'
    | 'executive';
  industry?: string;
  location?: string;
  salary?: string;
}

@Injectable()
export class JobDescriptionParserService {
  private readonly logger = new Logger(JobDescriptionParserService.name);

  constructor(private openAIService: OpenAIService) {}

  /**
   * Parse job description and extract structured data
   */
  async parseJobDescription(
    jobDescriptionText: string,
    costAccumulator?: AiCostAccumulator,
  ): Promise<ParsedJobDescription> {
    try {
      const schema = {
        jobTitle: 'job title',
        companyName: 'company name (if mentioned)',
        requiredSkills: 'array of required skills mentioned',
        requiredTools: 'array of required tools/software mentioned',
        keyResponsibilities: 'array of key responsibilities',
        preferredExperience:
          'experience level preferred (e.g., "3-5 years", "Senior", "Entry-level")',
        toneStyle:
          'one of: formal, corporate, creative, startup, friendly, executive (based on language and style)',
        industry: 'industry or sector',
        location: 'job location',
        salary: 'salary range if mentioned',
      };

      const systemPrompt = `You are a job description parser. Extract structured information from the job description text provided. 
Return a JSON object with the following structure:
- jobTitle: the exact job title
- companyName: company name (if mentioned, otherwise empty string)
- requiredSkills: array of all skills mentioned (technical and soft skills)
- requiredTools: array of tools, software, technologies mentioned
- keyResponsibilities: array of main responsibilities (3-5 key ones)
- preferredExperience: experience level (e.g., "3-5 years", "Senior", "Mid-level", "Entry-level")
- toneStyle: determine the tone/style based on language used (formal, corporate, creative, startup, friendly, executive)
- industry: industry or sector if mentioned
- location: job location if mentioned
- salary: salary range if mentioned

Be thorough and accurate.`;

      const extracted = await this.openAIService.extractStructuredData(
        jobDescriptionText,
        schema,
        systemPrompt,
      );

      addExtractionUsageToAccumulator(costAccumulator, extracted);

      if (!extracted?.data) {
        // Fallback parsing using regex patterns
        return this.fallbackParse(jobDescriptionText);
      }

      const data = extracted.data;
      return {
        jobTitle: data.jobTitle || '',
        companyName: data.companyName || '',
        requiredSkills: data.requiredSkills || [],
        requiredTools: data.requiredTools || [],
        keyResponsibilities: data.keyResponsibilities || [],
        preferredExperience: data.preferredExperience || '',
        toneStyle: this.normalizeToneStyle(data.toneStyle) || 'formal',
        industry: data.industry,
        location: data.location,
        salary: data.salary,
      };
    } catch (error) {
      this.logger.error('Error parsing job description', error);
      return this.fallbackParse(jobDescriptionText);
    }
  }

  /**
   * Fallback parsing using regex patterns
   */
  private fallbackParse(jobDescriptionText: string): ParsedJobDescription {
    const text = jobDescriptionText.toLowerCase();

    // Extract job title (look for patterns like "Job Title:", "Position:", "We are hiring a")
    const titleMatch = jobDescriptionText.match(
      /(?:job title|position|hiring|looking for)[:\-]?\s*([^\n]+)/i,
    );
    const jobTitle = titleMatch ? titleMatch[1].trim() : '';

    // Extract company name
    const companyMatch = jobDescriptionText.match(
      /(?:about|company|at|join)[:\-]?\s*([A-Z][A-Za-z\s&]+)/,
    );
    const companyName = companyMatch ? companyMatch[1].trim() : '';

    // Extract skills (look for "Skills:", "Requirements:", "Must have")
    const skillsSection = jobDescriptionText.match(
      /(?:skills|requirements|must have|qualifications)[:\-]?([^.]{50,500})/i,
    );
    const requiredSkills = skillsSection
      ? this.extractListItems(skillsSection[1])
      : [];

    // Extract tools/technologies
    const tools = [
      'python',
      'javascript',
      'react',
      'node',
      'aws',
      'docker',
      'kubernetes',
      'sql',
      'git',
    ];
    const requiredTools = tools.filter((tool) => text.includes(tool));

    // Determine tone style
    let toneStyle: ParsedJobDescription['toneStyle'] = 'formal';
    if (
      text.includes('startup') ||
      text.includes('fast-paced') ||
      text.includes('dynamic')
    ) {
      toneStyle = 'startup';
    } else if (
      text.includes('creative') ||
      text.includes('innovative') ||
      text.includes('design')
    ) {
      toneStyle = 'creative';
    } else if (
      text.includes('executive') ||
      text.includes('leadership') ||
      text.includes('strategic')
    ) {
      toneStyle = 'executive';
    } else if (
      text.includes('team') ||
      text.includes('collaborative') ||
      text.includes('friendly')
    ) {
      toneStyle = 'friendly';
    } else if (text.includes('corporate') || text.includes('enterprise')) {
      toneStyle = 'corporate';
    }

    return {
      jobTitle,
      companyName,
      requiredSkills,
      requiredTools,
      keyResponsibilities: [],
      preferredExperience: '',
      toneStyle,
    };
  }

  /**
   * Extract list items from text
   */
  private extractListItems(text: string): string[] {
    const items: string[] = [];
    // Match bullet points, numbered lists, or dash-separated items
    const matches = text.match(/(?:[-•*]\s*|\d+[.)]\s*)([^\n]+)/g);
    if (matches) {
      items.push(...matches.map((m) => m.replace(/^[-•*\d.)\s]+/, '').trim()));
    }
    return items.filter((item) => item.length > 0);
  }

  /**
   * Normalize tone style
   */
  private normalizeToneStyle(tone?: string): ParsedJobDescription['toneStyle'] {
    if (!tone) return 'formal';
    const normalized = tone.toLowerCase();
    if (normalized.includes('formal')) return 'formal';
    if (normalized.includes('corporate')) return 'corporate';
    if (normalized.includes('creative')) return 'creative';
    if (normalized.includes('startup')) return 'startup';
    if (normalized.includes('friendly')) return 'friendly';
    if (normalized.includes('executive')) return 'executive';
    return 'formal';
  }
}
