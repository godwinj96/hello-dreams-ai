import { Injectable, Logger } from '@nestjs/common';
import { AiChatService } from '../../resume-builder/services/ai-chat.service';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';
import { PersonaArchetype } from '../enums/persona-archetype.enum';
import {
  PersonaDescription,
  TransformationPlaybook,
} from './persona-content.service';

export interface PersonaAiInput {
  currentPersona: PersonaArchetype;
  idealPersona: PersonaArchetype;
  /** The user's actual questionnaire choices, as readable text. */
  answers: Array<{ question: string; answer: string }>;
  targetJobTitle?: string;
  careerGoal?: string;
  background?: string;
  experience?: string;
}

export interface PersonaAiResult {
  currentPersonaDescription: PersonaDescription;
  playbook: TransformationPlaybook;
}

const PLAYBOOK_KEYS = [
  'speakingStyle',
  'dressingForImpact',
  'workplaceBehaviour',
  'meetingMastery',
  'digitalPresence',
] as const;

/**
 * Turns the deterministic archetype result into advice written for this
 * specific user.
 *
 * The archetype scoring stays rule-based (cheap and reproducible), but the
 * prose around it used to be a fixed lookup table keyed only by archetype pair
 * — so two people with the same archetypes got byte-identical "analysis".
 * Everything here degrades to that static content if no provider answers.
 */
@Injectable()
export class PersonaAiService {
  private readonly logger = new Logger(PersonaAiService.name);

  constructor(private readonly aiChatService: AiChatService) {}

  async personalise(input: PersonaAiInput): Promise<PersonaAiResult | null> {
    try {
      const answerLines = input.answers
        .map((a, i) => `${i + 1}. ${a.question}\n   → ${a.answer}`)
        .join('\n');

      const context = [
        input.targetJobTitle ? `Target role: ${input.targetJobTitle}` : null,
        input.careerGoal ? `Career goal: ${input.careerGoal}` : null,
        input.background ? `Background: ${input.background}` : null,
        input.experience ? `Experience: ${input.experience}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const systemPrompt = `You are a professional brand coach analysing a workplace persona questionnaire.

The user's assessed current persona is "${input.currentPersona}" and the persona that best fits their goals is "${input.idealPersona}".

Write analysis grounded in THEIR specific answers and career context — not generic advice about the archetype. Quote or paraphrase their actual choices where it helps.

Return ONLY a JSON object, no markdown fence, in exactly this shape:
{
  "howPeopleSeeYou": "2-3 sentences, second person, describing how colleagues currently experience them",
  "strengths": ["4 short phrases drawn from their answers"],
  "growthOpportunities": ["4 short phrases naming what holds them back"],
  "playbook": {
    "speakingStyle": ["3 concrete actions"],
    "dressingForImpact": ["2-3 concrete actions"],
    "workplaceBehaviour": ["3 concrete actions"],
    "meetingMastery": ["3 concrete actions"],
    "digitalPresence": ["3 concrete actions"]
  }
}

Rules:
- Every list item is a single actionable sentence, under 18 words.
- Never use bracketed placeholders like [role] or [number]. Omit the detail instead.
- If current and ideal persona match, the playbook should amplify their existing strengths.
- Reference their target role where it is known.`;

      const userPrompt = `Their questionnaire answers:\n${answerLines}\n\n${
        context
          ? `Their career context:\n${context}`
          : 'No career context recorded.'
      }`;

      const raw = await this.aiChatService.chat([
        { role: MessageRole.System, content: systemPrompt },
        { role: MessageRole.User, content: userPrompt },
      ]);

      const parsed = this.parseJson(raw);
      if (!parsed) return null;

      const description: PersonaDescription = {
        howPeopleSeeYou: this.asText(parsed.howPeopleSeeYou),
        strengths: this.asList(parsed.strengths),
        growthOpportunities: this.asList(parsed.growthOpportunities),
      };

      const playbookSource = (parsed.playbook ?? {}) as Record<string, unknown>;
      const playbook = {} as TransformationPlaybook;
      for (const key of PLAYBOOK_KEYS) {
        playbook[key] = this.asList(playbookSource[key]);
      }

      // Partial output is worse than the static fallback, so require the core
      // fields before we accept it.
      if (
        !description.howPeopleSeeYou ||
        description.strengths.length === 0 ||
        description.growthOpportunities.length === 0 ||
        PLAYBOOK_KEYS.some((k) => playbook[k].length === 0)
      ) {
        this.logger.warn(
          'Persona AI response was incomplete — using static content',
        );
        return null;
      }

      return { currentPersonaDescription: description, playbook };
    } catch (error) {
      this.logger.warn(
        'Persona AI personalisation unavailable — using static content',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /** Models often wrap JSON in prose or a code fence. */
  private parseJson(raw: string): Record<string, unknown> | null {
    if (!raw) return null;
    const withoutFence = raw
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();

    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      const parsed: unknown = JSON.parse(withoutFence.slice(start, end + 1));
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      this.logger.warn('Persona AI returned unparseable JSON');
      return null;
    }
  }

  private asText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  /** Drops empties and anything still carrying a [placeholder]. */
  private asList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v) => v.length > 0 && !/\[[^\]]{2,40}\]/.test(v));
  }
}
