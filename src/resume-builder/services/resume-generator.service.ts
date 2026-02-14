import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AiChatService, ChatMessage } from './ai-chat.service';
import { MessageRole } from '../enums/message-role.enum';
import { buildJsonOnlyInstruction, parseJsonObject } from '../../shared/utils/json-llm.util';

export interface ResumeJson {
  contact: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    links?: {
      linkedIn?: string;
      github?: string;
      portfolio?: string;
      other?: string[];
    };
  };
  summary?: string;
  workExperience?: Array<{
    jobTitle: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    achievements?: string[];
    responsibilities?: string[];
    tools?: string[];
    highlights?: string[];
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    graduationYear?: number;
    honors?: string;
  }>;
  skills?: {
    core?: string[];
    technical?: string[];
    soft?: string[];
    tools?: string[];
    languages?: string[];
  };
  projects?: Array<{
    name: string;
    description?: string;
    impact?: string;
    technologies?: string[];
    links?: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuingOrganization?: string;
    date?: string;
  }>;
  achievements?: Array<{
    title: string;
    description?: string;
    date?: string;
  }>;
}

@Injectable()
export class ResumeGeneratorService {
  private readonly logger = new Logger(ResumeGeneratorService.name);

  constructor(private aiChatService: AiChatService) {}

  /**
   * Generate a resume based on conversation messages
   * This will ask the AI to generate the final resume using all collected information
   */
  async generateResume(messages: ChatMessage[]): Promise<ResumeJson> {
    try {
      const resumeSchemaDescription = `
Top-level JSON object with these keys:
- contact: object { fullName, email, phone, location, links{linkedIn, github, portfolio, other[]} }
- summary: string (2-4 sentences)
- workExperience: array of objects { jobTitle, company, location, startDate, endDate, achievements[], responsibilities[], tools[], highlights[] }
- education: array of objects { degree, institution, graduationYear, honors }
- skills: object { core[], technical[], soft[], tools[], languages[] }
- projects: array of objects { name, description, impact, technologies[], links[] }
- certifications: array of objects { name, issuingOrganization, date }
- achievements: array of objects { title, description, date }
All sections are objects; subsections are nested objects/arrays.`;

      const example: ResumeJson = {
        contact: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+1 555-123-4567',
          location: 'Austin, TX, USA',
          links: {
            linkedIn: 'https://linkedin.com/in/janedoe',
            github: 'https://github.com/janedoe',
            portfolio: 'https://janedoe.com',
          },
        },
        summary: 'Product manager with 8+ years delivering B2B SaaS outcomes...',
        workExperience: [
          {
            jobTitle: 'Senior Product Manager',
            company: 'Acme Corp',
            startDate: '2021-03',
            endDate: 'Present',
            achievements: [
              'Led launch of X improving activation by 18%.',
              'Partnered with sales to grow ARR by $1.2M.',
            ],
            tools: ['Jira', 'Figma', 'SQL'],
          },
        ],
        education: [
          { degree: 'B.Sc. Computer Science', institution: 'UT Austin', graduationYear: 2016 },
        ],
        skills: {
          core: ['Product Strategy', 'A/B Testing'],
          technical: ['SQL', 'APIs'],
          tools: ['Jira', 'Figma'],
          languages: ['English', 'Spanish'],
        },
        projects: [
          {
            name: 'Experimentation Platform',
            description: 'Built internal A/B platform for 20 squads',
            technologies: ['Node.js', 'Postgres', 'React'],
          },
        ],
        certifications: [{ name: 'CSPO', issuingOrganization: 'Scrum Alliance', date: '2022' }],
        achievements: [{ title: 'President Club', description: 'Top 5% PM impact', date: '2023' }],
      };

      const systemPrompt = buildJsonOnlyInstruction(resumeSchemaDescription, example);

      const messagesWithPrompt: ChatMessage[] = [
        { role: MessageRole.System, content: systemPrompt },
        ...messages,
        {
          role: MessageRole.User,
          content:
            'Generate the resume JSON now using the agreed schema. Respond with JSON only.',
        },
      ];

      const resumeContent = await this.aiChatService.chat(messagesWithPrompt);
      const parsed = parseJsonObject<ResumeJson>(resumeContent);

      if (!parsed.ok || !parsed.data) {
        throw new BadRequestException(parsed.error || 'Model did not return valid JSON.');
      }

      return parsed.data;
    } catch (error) {
      this.logger.error('Error generating resume', error);
      throw new Error('Failed to generate resume. Please try again.');
    }
  }
}
