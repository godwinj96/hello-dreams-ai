import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResumeData } from '../../resume-builder/entities/resume-data.entity';
import { Resume } from '../../resume-builder/entities/resume.entity';
import { Document } from '../../document-generator/entities/document.entity';
import { DocumentConversation } from '../../document-generator/entities/document-conversation.entity';
import { DocumentType } from '../../document-generator/enums/document-type.enum';
import { ConversationStatus } from '../../resume-builder/enums/conversation-status.enum';
import { OpenAIService } from '../../shared/services/openai.service';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';
import { JobApplication } from '../entities/job-application.entity';
import { JobListing } from '../entities/job-listing.entity';
import { AiCostAccumulator } from '../../shared/utils/ai-cost-accumulator';
import { addChatUsageToAccumulator } from '../../shared/utils/ai-usage.helpers';

@Injectable()
export class JobDocumentGeneratorService {
  private readonly logger = new Logger(JobDocumentGeneratorService.name);

  constructor(
    @InjectRepository(ResumeData)
    private resumeDataRepository: Repository<ResumeData>,
    @InjectRepository(Resume)
    private resumeRepository: Repository<Resume>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(DocumentConversation)
    private docConversationRepository: Repository<DocumentConversation>,
    @InjectRepository(JobApplication)
    private applicationRepository: Repository<JobApplication>,
    private openAIService: OpenAIService,
  ) {}

  async generateDocuments(
    application: JobApplication,
    listing: JobListing,
    userId: string,
    costAccumulator?: AiCostAccumulator,
  ): Promise<{ resume: Record<string, any>; coverLetter: Record<string, any> }> {
    // Fetch user's latest resume data
    const resumeData = await this.getLatestResumeData(userId);
    if (!resumeData) {
      throw new BadRequestException(
        'Please complete the CV Builder first — your resume data is needed to generate tailored documents.',
      );
    }

    const prompt = this.buildPrompt(resumeData, listing);

    let rawOutput: string;
    try {
      const result = await this.openAIService.chatWithUsage(
        [{ role: MessageRole.User, content: prompt }],
        undefined,
        0.7,
        4096,
      );
      addChatUsageToAccumulator(costAccumulator, {
        operation: 'chat',
        provider: 'openai',
        model: result.model,
        usage: result.usage,
      });
      rawOutput = result.content;
    } catch (err) {
      this.logger.error(`OpenAI generation failed: ${err.message}`);
      throw err;
    }

    const { resume, coverLetter } = this.parseOutput(rawOutput);

    // Persist cover letter as a Document entity (requires a DocumentConversation)
    // Note: we do NOT create a standalone Resume entity here because Resume.conversationId
    // has a unique FK to resume_conversations. The resume is stored on the application JSONB instead.
    const syntheticConversation = await this.docConversationRepository.save(
      this.docConversationRepository.create({
        userId,
        title: `Cover letter — ${listing.title} @ ${listing.company ?? 'Company'}`,
        documentType: DocumentType.CoverLetter,
        status: ConversationStatus.Completed,
        targetJobTitle: listing.title,
        targetCompany: listing.company ?? undefined,
        jobDescription: listing.description ?? undefined,
        messagesJsonb: [],
        tokenCount: 0,
      }),
    );

    const docEntity = await this.documentRepository.save(
      this.documentRepository.create({
        userId,
        conversationId: syntheticConversation.id,
        documentType: DocumentType.CoverLetter,
        content: coverLetter,
        version: 1,
        targetJobTitle: listing.title,
        targetCompany: listing.company ?? undefined,
      }),
    );

    // Store both documents on the application record
    application.generatedResumeContent = resume;
    application.generatedCoverLetterContent = coverLetter;
    application.customCoverLetterId = docEntity.id;
    await this.applicationRepository.save(application);

    return { resume, coverLetter };
  }

  private async getLatestResumeData(userId: string): Promise<ResumeData | null> {
    // ResumeData is linked via Resume entity
    const latestResume = await this.resumeRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (!latestResume) return null;

    return this.resumeDataRepository.findOne({
      where: { resumeId: latestResume.id },
    });
  }

  private buildPrompt(resumeData: ResumeData, listing: JobListing): string {
    const resumeJson = JSON.stringify({
      contactInfo: resumeData.contactInfo,
      summary: resumeData.summary,
      workExperience: resumeData.workExperience,
      education: resumeData.education,
      skills: resumeData.skills,
      certifications: resumeData.certifications,
      projects: resumeData.projects,
      achievements: resumeData.achievements,
      languages: resumeData.languages,
      keyAchievements: resumeData.keyAchievements,
    });

    return `You are an expert career coach and professional resume writer.

Given the candidate's resume data and the job listing below, produce TWO tailored documents:
1. A tailored resume that highlights the most relevant experience, skills, and achievements for THIS specific job.
2. A compelling, professional cover letter specifically addressing this role and company.

JOB LISTING:
Title: ${listing.title}
Company: ${listing.company ?? 'Not specified'}
Location: ${listing.location ?? 'Not specified'}
Job Type: ${listing.jobType ?? 'Not specified'}
Description: ${listing.description?.substring(0, 3000) ?? 'Not provided'}

CANDIDATE RESUME DATA:
${resumeJson}

INSTRUCTIONS:
- Return ONLY a valid JSON object with exactly two top-level keys: "resume" and "coverLetter"
- Do NOT wrap in markdown code blocks
- "resume" must follow this schema exactly:
  {
    "contactInfo": { "fullName", "email", "phone", "location", "linkedIn", "github", "portfolio" },
    "summary": "string — tailored professional summary (2-3 sentences)",
    "workExperience": [ { "jobTitle", "company", "location", "startDate", "endDate", "responsibilities": [], "achievements": [], "tools": [] } ],
    "education": [ { "degree", "institution", "graduationYear", "honors" } ],
    "skills": { "technical": [], "soft": [], "tools": [] },
    "certifications": [ { "name", "issuingOrganization", "date" } ],
    "projects": [ { "name", "description", "technologies": [] } ],
    "achievements": [ { "title", "description", "date" } ],
    "languages": [ { "language", "proficiency" } ],
    "keyAchievements": []
  }
- "coverLetter" must follow this schema exactly:
  {
    "recipientName": "string or null",
    "recipientTitle": "string or null",
    "companyName": "string",
    "date": "ISO date string",
    "subject": "string",
    "body": "string — full cover letter body, 3-4 paragraphs, professional tone, specific to the job",
    "closing": "string",
    "senderName": "string"
  }
- Preserve ALL factual information from the resume; only reorder, emphasise, and reframe for relevance
- Do not invent experience, qualifications, or credentials the candidate does not have`;
  }

  private parseOutput(raw: string): { resume: Record<string, any>; coverLetter: Record<string, any> } {
    // Strip markdown fences if model adds them
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (!parsed.resume || !parsed.coverLetter) {
        throw new Error('Missing resume or coverLetter key in AI response');
      }
      return parsed;
    } catch (err) {
      this.logger.error(`Failed to parse AI output: ${err.message}\nRaw: ${raw.substring(0, 500)}`);
      throw new BadRequestException('Document generation failed — AI returned an unexpected format. Please try again.');
    }
  }
}
