import { Injectable, Logger } from '@nestjs/common';
import { ProfessionalProfileService } from '../../professional-profile/professional-profile.service';
import { ChatMessage } from '../../resume-builder/services/ai-chat.service';

/** Nothing a human calls a "skill" is longer than this. */
const MAX_ENTRY_CHARS = 120;
const MAX_ENTRIES = 20;
const MAX_TEXT_FIELD_CHARS = 600;

@Injectable()
export class CareerProfileExtractorService {
  private readonly logger = new Logger(CareerProfileExtractorService.name);

  constructor(private professionalProfileService: ProfessionalProfileService) {}

  /**
   * Best-effort regex extraction that fills gaps the AI extractor left behind.
   *
   * This used to run its patterns over the entire transcript, including the
   * assistant's turns, with unbounded `[^.!?]+` captures. With few sentence
   * terminators in a long chat a single "skill" grew past 900,000 characters of
   * leaked prompt text, which then fed every generated document. It now reads
   * only the user's own words, bounds every value, and never overwrites data
   * the AI extractor already produced.
   */
  async extractAndUpdateProfile(
    userId: string,
    messages: ChatMessage[],
  ): Promise<void> {
    try {
      // Only the user's own words describe the user. Assistant turns quote the
      // system prompt back (including the "✅ I have enough..." line), which is
      // how prompt text ended up stored as the user's skills.
      const conversationText = messages
        .filter((msg) => String(msg.role).toLowerCase() === 'user')
        .map((msg) => msg.content)
        .join('\n');

      if (!conversationText.trim()) return;

      const existing = await this.professionalProfileService.getProfile(userId);

      const extracted = this.extractStructuredData(conversationText);
      const gapFill = this.onlyMissing(extracted, existing.extractedData);

      if (Object.keys(gapFill).length > 0) {
        await this.professionalProfileService.updateExtractedData(
          userId,
          gapFill,
        );
      }

      const careerGoals = this.extractCareerGoals(conversationText);
      const goalsGapFill = this.onlyMissing(careerGoals, existing.careerGoals);
      if (Object.keys(goalsGapFill).length > 0) {
        await this.professionalProfileService.updateCareerGoals(
          userId,
          goalsGapFill,
        );
      }
    } catch (error) {
      this.logger.error('Error extracting profile data', error);
      // Don't throw - extraction is best effort
    }
  }

  /** Drops keys the profile already has a usable value for. */
  private onlyMissing(
    candidate: Record<string, unknown>,
    current: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(candidate)) {
      const existingValue = current?.[key];
      const existingIsPresent = Array.isArray(existingValue)
        ? existingValue.length > 0
        : typeof existingValue === 'string'
          ? existingValue.trim().length > 0
          : existingValue !== undefined && existingValue !== null;

      if (!existingIsPresent) result[key] = value;
    }

    return result;
  }

  /**
   * Splits on sentence terminators AND newlines, so a chat message without
   * punctuation cannot produce one enormous capture.
   */
  private sentences(text: string): string[] {
    return text
      .split(/[.!?\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private toEntries(text: string, pattern: RegExp): string[] {
    const seen = new Set<string>();
    const entries: string[] = [];

    for (const sentence of this.sentences(text)) {
      if (sentence.length > MAX_ENTRY_CHARS) continue;

      // `pattern` is global, and RegExp.test on a global regex advances
      // lastIndex — reset it or every other call spuriously misses.
      pattern.lastIndex = 0;
      if (!pattern.test(sentence)) continue;
      pattern.lastIndex = 0;

      const cleaned = sentence.replace(pattern, '').replace(/\s+/g, ' ').trim();
      if (!cleaned) continue;

      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      entries.push(cleaned);
      if (entries.length >= MAX_ENTRIES) break;
    }

    return entries;
  }

  private extractStructuredData(
    conversationText: string,
  ): Record<string, unknown> {
    const extracted: Record<string, unknown> = {};

    const skills = this.toEntries(
      conversationText,
      /\b(skills?|proficient|expert|knowledge)\b/gi,
    );
    if (skills.length > 0) extracted.skills = skills;

    const achievements = this.toEntries(
      conversationText,
      /\b(achieved|accomplished|award|recognition)\b/gi,
    );
    if (achievements.length > 0) extracted.achievements = achievements;

    const education = this.toEntries(
      conversationText,
      /\b(education|degree|university|college|graduated)\b/gi,
    );
    if (education.length > 0) {
      extracted.education = education.join('; ').slice(0, MAX_TEXT_FIELD_CHARS);
    }

    return extracted;
  }

  private extractCareerGoals(
    conversationText: string,
  ): Record<string, unknown> {
    const goals: Record<string, unknown> = {};

    const targetRoles = this.toEntries(
      conversationText,
      /\b(target|aspire)\b.*?\b(role|position|title)\b/gi,
    );
    if (targetRoles.length > 0) goals.targetRoles = targetRoles;

    const targetIndustries = this.toEntries(
      conversationText,
      /\b(industry|sector)\b/gi,
    );
    if (targetIndustries.length > 0) goals.targetIndustries = targetIndustries;

    const aspirations = this.toEntries(
      conversationText,
      /\b(aspiration|dream|vision)\b/gi,
    );
    if (aspirations.length > 0) {
      goals.careerAspirations = aspirations
        .join('; ')
        .slice(0, MAX_TEXT_FIELD_CHARS);
    }

    return goals;
  }
}
