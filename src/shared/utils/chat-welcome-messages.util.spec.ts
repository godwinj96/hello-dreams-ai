import { DocumentType } from '../../document-generator/enums/document-type.enum';
import {
  getCareerProfileWelcome,
  getCvUploadConfirmation,
  getDocumentGeneratorWelcome,
  getResumeBuilderWelcome,
} from './chat-welcome-messages.util';

function countQuestions(text: string): number {
  return (text.match(/\?/g) || []).length;
}

describe('chat-welcome-messages.util', () => {
  describe('getCareerProfileWelcome', () => {
    it('returns a non-empty greeting with one question', () => {
      const greeting = getCareerProfileWelcome();
      expect(greeting.length).toBeGreaterThan(0);
      expect(countQuestions(greeting)).toBe(1);
      expect(greeting).toContain('Hi Dreamer!');
      expect(greeting).toContain('Generate Profile Summary');
    });
  });

  describe('getCvUploadConfirmation', () => {
    it('returns a non-empty message with one question', () => {
      const message = getCvUploadConfirmation();
      expect(message.length).toBeGreaterThan(0);
      expect(countQuestions(message)).toBe(1);
      expect(message).toContain('Generate Profile Summary');
    });
  });

  describe('getResumeBuilderWelcome', () => {
    it('asks for full name when no basic info exists', () => {
      const greeting = getResumeBuilderWelcome({ hasBasicInfo: false });
      expect(countQuestions(greeting)).toBe(1);
      expect(greeting).toContain('full name');
      expect(greeting).toContain('Generate Resume');
    });

    it('asks for company when basic info and name exist', () => {
      const greeting = getResumeBuilderWelcome({
        hasBasicInfo: true,
        name: 'Sarah',
      });
      expect(countQuestions(greeting)).toBe(1);
      expect(greeting).toContain('Hi Sarah!');
      expect(greeting).toContain('which company');
      expect(greeting).not.toContain('full name');
    });
  });

  describe('getDocumentGeneratorWelcome', () => {
    it('returns cover letter greeting with job description', () => {
      const greeting = getDocumentGeneratorWelcome({
        documentType: DocumentType.CoverLetter,
        name: 'Alex',
        hasJobDescription: true,
      });
      expect(countQuestions(greeting)).toBe(1);
      expect(greeting).toContain('Hi Alex!');
      expect(greeting).toContain('job description');
    });

    it('returns cover letter greeting without job description', () => {
      const greeting = getDocumentGeneratorWelcome({
        documentType: DocumentType.CoverLetter,
        name: 'Alex',
        hasJobDescription: false,
      });
      expect(countQuestions(greeting)).toBe(1);
      expect(greeting).toContain('Hi Alex!');
      expect(greeting).toContain('What role and company');
    });

    it('returns personal statement greeting', () => {
      const greeting = getDocumentGeneratorWelcome({
        documentType: DocumentType.PersonalStatement,
        name: 'Jordan',
      });
      expect(countQuestions(greeting)).toBe(1);
      expect(greeting).toContain('Hi Jordan!');
      expect(greeting).toContain('personal statement');
    });

    it('falls back to "there" when name is missing', () => {
      const greeting = getDocumentGeneratorWelcome({
        documentType: DocumentType.CoverLetter,
        hasJobDescription: false,
      });
      expect(greeting).toContain('Hi there!');
    });
  });
});
