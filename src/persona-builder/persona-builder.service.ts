import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonaAnswer } from './entities/persona-answer.entity';
import { SubmitAnswersDto, AnswerDto } from './dto/submit-answers.dto';
import { PersonaResponseDto, QuestionDto } from './dto/persona-response.dto';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import {
  AiChatService,
  ChatMessage,
} from '../resume-builder/services/ai-chat.service';
import { MessageRole } from '../resume-builder/enums/message-role.enum';

@Injectable()
export class PersonaBuilderService {
  private readonly logger = new Logger(PersonaBuilderService.name);

  constructor(
    @InjectRepository(PersonaAnswer)
    private answerRepository: Repository<PersonaAnswer>,
    private professionalProfileService: ProfessionalProfileService,
    private aiChatService: AiChatService,
  ) {}

  async getQuestions(): Promise<QuestionDto[]> {
    // Questions are managed on the frontend and sent with answers
    // This endpoint can return empty array or be removed if not needed
    return [];
  }

  async submitAnswers(
    userId: string,
    submitDto: SubmitAnswersDto,
  ): Promise<PersonaAnswer[]> {
    // Delete existing answers for this user
    await this.answerRepository.delete({ userId });

    // Save new answers
    const answers = submitDto.answers.map((answer) =>
      this.answerRepository.create({
        userId,
        questionId: answer.questionId,
        question: answer.question,
        answer: answer.answer,
      } as Partial<PersonaAnswer>),
    );

    return await this.answerRepository.save(answers);
  }

  async getUserAnswers(userId: string): Promise<PersonaAnswer[]> {
    return await this.answerRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async generatePersona(userId: string): Promise<PersonaResponseDto> {
    // Get user answers
    const answers = await this.getUserAnswers(userId);

    if (answers.length === 0) {
      throw new Error('No answers found. Please submit answers first.');
    }

    // Format answers for AI
    const answersText = answers
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join('\n\n');

    // Create prompt for persona generation
    const systemPrompt = this.getPersonaGenerationPrompt();
    const userPrompt = `Based on the following answers, analyze and generate a professional persona that describes the user's communication style, tone, professional voice, and writing preferences:\n\n${answersText}`;

    const messages: ChatMessage[] = [
      { role: MessageRole.System, content: systemPrompt },
      { role: MessageRole.User, content: userPrompt },
    ];

    // Get AI response
    let aiResponse: string;
    try {
      aiResponse = await this.aiChatService.chat(messages);
    } catch (error) {
      this.logger.error('Error generating persona', error);
      throw new Error('Failed to generate persona. Please try again.');
    }

    // Parse AI response to extract persona
    const persona = this.parsePersonaFromResponse(aiResponse);

    // Update professional profile with persona
    await this.professionalProfileService.updatePersona(userId, persona);

    // Mark persona section as complete
    await this.professionalProfileService.markSectionComplete(
      userId,
      'persona',
    );

    const profile = await this.professionalProfileService.getProfile(userId);

    return {
      id: profile.id,
      userId: profile.userId,
      persona: profile.persona || {},
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async getPersona(userId: string): Promise<PersonaResponseDto | null> {
    const profile = await this.professionalProfileService.getProfile(userId);

    if (!profile.persona || Object.keys(profile.persona).length === 0) {
      return null;
    }

    return {
      id: profile.id,
      userId: profile.userId,
      persona: profile.persona,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private getPersonaGenerationPrompt(): string {
    return `You are a professional persona analyst. Your task is to analyze user answers to questions about their communication style and professional preferences, then generate a structured persona description.

Based on the user's answers, extract and describe:
1. Communication Style: How they communicate (e.g., direct, diplomatic, collaborative, assertive)
2. Tone: The tone they prefer (e.g., professional, friendly, confident, approachable, formal)
3. Professional Voice: How they want to be perceived (e.g., expert, leader, innovator, team player)
4. Writing Style: Their preferred writing style (e.g., concise, detailed, storytelling, data-driven)
5. Personality Traits: Key traits to highlight (e.g., analytical, creative, strategic, empathetic)
6. Preferences: Any specific preferences mentioned

Format your response as a JSON object with these keys, or provide a clear structured description that can be parsed into these categories. Be specific and actionable.`;
  }

  private parsePersonaFromResponse(aiResponse: string): any {
    // Try to extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // If JSON parsing fails, continue with text parsing
      }
    }

    // Fallback: parse text response
    const persona: any = {};

    // Extract communication style
    const commStyleMatch = aiResponse.match(
      /communication style[:\-]?\s*([^.\n]+)/i,
    );
    if (commStyleMatch) {
      persona.communicationStyle = commStyleMatch[1].trim();
    }

    // Extract tone
    const toneMatch = aiResponse.match(/tone[:\-]?\s*([^.\n]+)/i);
    if (toneMatch) {
      persona.tone = toneMatch[1].trim();
    }

    // Extract professional voice
    const voiceMatch = aiResponse.match(
      /professional voice[:\-]?\s*([^.\n]+)/i,
    );
    if (voiceMatch) {
      persona.professionalVoice = voiceMatch[1].trim();
    }

    // Extract writing style
    const writingMatch = aiResponse.match(/writing style[:\-]?\s*([^.\n]+)/i);
    if (writingMatch) {
      persona.writingStyle = writingMatch[1].trim();
    }

    // Extract personality traits
    const traitsMatch = aiResponse.match(
      /personality traits?[:\-]?\s*([^.\n]+)/i,
    );
    if (traitsMatch) {
      persona.personalityTraits = traitsMatch[1]
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    // Store full response as preferences if structured parsing didn't work well
    if (Object.keys(persona).length === 0) {
      persona.preferences = { fullDescription: aiResponse };
    }

    return persona;
  }
}
