import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../../shared/services/openai.service';
import { ProfessionalProfileService } from '../../professional-profile/professional-profile.service';
import * as mammoth from 'mammoth';

@Injectable()
export class CvParserService {
  private readonly logger = new Logger(CvParserService.name);

  constructor(
    private openAIService: OpenAIService,
    private professionalProfileService: ProfessionalProfileService,
  ) {}

  /**
   * Parse CV file and extract structured data
   */
  async parseCv(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{
    pastJobTitles: string[];
    experienceLevel: string;
    industries: string[];
    keywords: string[];
    workHistory: Array<{
      jobTitle?: string;
      company?: string;
      duration?: string;
      responsibilities?: string[];
    }>;
  }> {
    try {
      // Extract text from CV
      let cvText: string;

      if (file.mimetype === 'application/pdf') {
        cvText = await this.extractTextFromPdf(file.buffer);
      } else if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/msword'
      ) {
        cvText = await this.extractTextFromDocx(file.buffer);
      } else {
        throw new Error(`Unsupported file type: ${file.mimetype}`);
      }

      // Parse structured data using AI
      const extractedData = await this.extractStructuredData(cvText);

      // Save to professional profile
      await this.professionalProfileService.updateCvMetadata(userId, extractedData);

      return extractedData;
    } catch (error) {
      this.logger.error('Error parsing CV', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer
   */
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
      // Polyfill DOMMatrix for Node.js environment (required by pdfjs-dist)
      if (typeof global.DOMMatrix === 'undefined') {
        global.DOMMatrix = class {
          a: number;
          b: number;
          c: number;
          d: number;
          e: number;
          f: number;
          constructor(init?: string | number[]) {
            if (init === undefined || init === null) {
              this.a = 1;
              this.b = 0;
              this.c = 0;
              this.d = 1;
              this.e = 0;
              this.f = 0;
            } else {
              // Simple identity matrix fallback
              this.a = 1;
              this.b = 0;
              this.c = 0;
              this.d = 1;
              this.e = 0;
              this.f = 0;
            }
          }
        } as any;
      }

      // Use dynamic import to avoid loading pdf-parse at module initialization
      // pdf-parse is a CommonJS module, handle both default and namespace imports
      const pdfParseModule = await import('pdf-parse');
      // Handle both CommonJS (default) and ESM imports
      const pdfParseFunction = (pdfParseModule as any).default || pdfParseModule;
      const data = await pdfParseFunction(buffer);
      return data.text;
    } catch (error) {
      this.logger.error('Error extracting text from PDF', error);
      throw new Error('Failed to extract text from PDF. Please ensure the PDF is valid and try again.');
    }
  }

  /**
   * Extract text from DOCX buffer
   */
  private async extractTextFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      this.logger.error('Error extracting text from DOCX', error);
      throw new Error('Failed to extract text from DOCX');
    }
  }

  /**
   * Extract structured data from CV text using AI
   */
  private async extractStructuredData(cvText: string): Promise<{
    pastJobTitles: string[];
    experienceLevel: string;
    industries: string[];
    keywords: string[];
    workHistory: Array<{
      jobTitle?: string;
      company?: string;
      duration?: string;
      responsibilities?: string[];
    }>;
  }> {
    const schema = {
      pastJobTitles: 'array of job titles from work history',
      experienceLevel: 'one of: student, entry-level, mid-level, senior, executive',
      industries: 'array of industries the person has worked in',
      keywords: 'array of key skills and technologies mentioned',
      workHistory: 'array of work experience objects with jobTitle, company, duration, and responsibilities',
    };

    const systemPrompt = `You are a CV parser. Extract structured information from the CV text provided. 
Return a JSON object with the following structure:
- pastJobTitles: array of all job titles found
- experienceLevel: one of: student, entry-level, mid-level, senior, executive (based on years of experience and seniority of roles)
- industries: array of industries/sectors mentioned
- keywords: array of important skills, technologies, tools mentioned
- workHistory: array of work experience entries, each with jobTitle, company, duration (e.g., "2020-2022"), and responsibilities (array of strings)

Be thorough and accurate. Only extract information that is clearly stated in the CV.`;

    try {
      const extracted = await this.openAIService.extractStructuredData(
        cvText,
        schema,
        systemPrompt,
      );

      if (!extracted?.data) {
        // Fallback: return empty structure
        return {
          pastJobTitles: [],
          experienceLevel: 'entry-level',
          industries: [],
          keywords: [],
          workHistory: [],
        };
      }

      const data = extracted.data;
      return {
        pastJobTitles: data.pastJobTitles || [],
        experienceLevel: data.experienceLevel || 'entry-level',
        industries: data.industries || [],
        keywords: data.keywords || [],
        workHistory: data.workHistory || [],
      };
    } catch (error) {
      this.logger.error('Error extracting structured data from CV', error);
      // Return empty structure as fallback
      return {
        pastJobTitles: [],
        experienceLevel: 'entry-level',
        industries: [],
        keywords: [],
        workHistory: [],
      };
    }
  }
}

