import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonaAnswer } from './entities/persona-answer.entity';
import { SubmitAnswersDto, AnswerDto } from './dto/submit-answers.dto';
import { PersonaResponseDto, QuestionDto } from './dto/persona-response.dto';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import { PersonaScoringService } from './services/persona-scoring.service';
import { PersonaContentService } from './services/persona-content.service';
import { PersonaArchetype } from './enums/persona-archetype.enum';
import { PERSONA_QUESTIONS } from './constants/persona-questions';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';
import { ContextIndexerService } from '../shared/services/context-indexer.service';

@Injectable()
export class PersonaBuilderService {
  private readonly logger = new Logger(PersonaBuilderService.name);

  constructor(
    @InjectRepository(PersonaAnswer)
    private answerRepository: Repository<PersonaAnswer>,
    private professionalProfileService: ProfessionalProfileService,
    private personaScoringService: PersonaScoringService,
    private personaContentService: PersonaContentService,
    private usageTrackingService: UsageTrackingService,
    private dashboardEventService: DashboardEventService,
    private contextIndexerService: ContextIndexerService,
  ) {}

  async getQuestions(): Promise<QuestionDto[]> {
    // Return the structured questions from constants
    return PERSONA_QUESTIONS.map((q) => ({
      id: q.id,
      question: q.question,
      category: 'persona',
    }));
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

    const savedAnswers = await this.answerRepository.save(answers);

    // Track answers submission
    this.usageTrackingService
      .trackAction(userId, 'answers_submitted', 'persona-builder', {
        answerCount: savedAnswers.length,
      })
      .catch((err) => console.error('Failed to track answers submission:', err));

    return savedAnswers;
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
      throw new NotFoundException('No answers found. Please submit answers first.');
    }

    // Build answer map (questionId -> optionId)
    // We need to match answers to options
    const answerMap = new Map<string, string>();
    answers.forEach((answer) => {
      const question = PERSONA_QUESTIONS.find((q) => q.id === answer.questionId);
      if (question) {
        // Try to find option by matching answer text
        const option = question.options.find(
          (opt) => opt.text === answer.answer,
        );
        if (option) {
          answerMap.set(answer.questionId, option.id);
        } else {
          // If exact match fails, use first option as fallback (shouldn't happen)
          this.logger.warn(
            `Could not find option for question ${answer.questionId} with answer "${answer.answer}"`,
          );
        }
      }
    });

    // Get user's target job and career goal from profile
    const profile = await this.professionalProfileService.getProfile(userId);
    const targetJobTitle = profile.targetJob?.targetJobTitle;
    const careerGoal = profile.targetJob?.careerGoal;

    // Calculate persona scores
    const scoringResult = this.personaScoringService.calculatePersona(
      answerMap,
      targetJobTitle,
      careerGoal,
    );

    // Get persona descriptions
    const currentPersonaDescription =
      this.personaContentService.getPersonaDescription(
        scoringResult.currentPersona,
      );
    const idealPersonaDescription =
      this.personaContentService.getPersonaDescription(scoringResult.idealPersona);

    // Generate transformation playbook
    const transformationPlaybook =
      this.personaContentService.generateTransformationPlaybook(
        scoringResult.currentPersona,
        scoringResult.idealPersona,
      );

    // Build persona data
    const personaData = {
      currentPersona: scoringResult.currentPersona,
      idealPersona: scoringResult.idealPersona,
      transformationPath: {
        fromPersona: scoringResult.currentPersona,
        toPersona: scoringResult.idealPersona,
        playbook: transformationPlaybook,
      },
      appliedPersona: false,
    };

    // Update professional profile
    await this.professionalProfileService.updatePersonaData(userId, personaData);

    // Mark persona section as complete
    await this.professionalProfileService.markSectionComplete(userId, 'persona');

    const updatedProfile = await this.professionalProfileService.getProfile(userId);

    // Map personaData with proper types (entity stores as string, DTO expects enum)
    const mappedPersonaData = updatedProfile.personaData ? {
      ...updatedProfile.personaData,
      currentPersona: updatedProfile.personaData.currentPersona as PersonaArchetype | undefined,
      idealPersona: updatedProfile.personaData.idealPersona as PersonaArchetype | undefined,
      transformationPath: updatedProfile.personaData.transformationPath ? {
        ...updatedProfile.personaData.transformationPath,
        fromPersona: updatedProfile.personaData.transformationPath.fromPersona as PersonaArchetype | undefined,
        toPersona: updatedProfile.personaData.transformationPath.toPersona as PersonaArchetype | undefined,
      } : undefined,
    } : personaData;

    // Index persona/profile embedding
    await this.contextIndexerService.indexPersona(userId, {
      persona: updatedProfile.persona,
      personaData: mappedPersonaData,
      careerGoals: updatedProfile.careerGoals,
    });

    // Track persona generation
    this.usageTrackingService
      .trackAction(userId, 'persona_generated', 'persona-builder', {
        currentPersona: scoringResult.currentPersona,
        idealPersona: scoringResult.idealPersona,
      })
      .catch((err) => console.error('Failed to track persona generation:', err));
    this.dashboardEventService.emitFeatureUsed(userId, 'persona-builder', 'persona_generated');

    return {
      id: updatedProfile.id,
      userId: updatedProfile.userId,
      persona: updatedProfile.persona || {},
      personaData: mappedPersonaData,
      currentPersonaDescription,
      createdAt: updatedProfile.createdAt,
      updatedAt: updatedProfile.updatedAt,
    };
  }

  async applyPersonaToProfile(userId: string): Promise<PersonaResponseDto> {
    const profile = await this.professionalProfileService.getProfile(userId);

    if (!profile.personaData || !profile.personaData.currentPersona) {
      throw new NotFoundException(
        'Persona not found. Please generate persona first.',
      );
    }

    // Mark persona as applied
    await this.professionalProfileService.updatePersonaData(userId, {
      ...profile.personaData,
      appliedPersona: true,
    });

    const updatedProfile = await this.professionalProfileService.getProfile(userId);

    const currentPersonaDescription =
      this.personaContentService.getPersonaDescription(
        updatedProfile.personaData!.currentPersona! as PersonaArchetype,
      );

    // Map personaData with proper types
    const mappedPersonaData = updatedProfile.personaData ? {
      ...updatedProfile.personaData,
      currentPersona: updatedProfile.personaData.currentPersona as PersonaArchetype | undefined,
      idealPersona: updatedProfile.personaData.idealPersona as PersonaArchetype | undefined,
      transformationPath: updatedProfile.personaData.transformationPath ? {
        ...updatedProfile.personaData.transformationPath,
        fromPersona: updatedProfile.personaData.transformationPath.fromPersona as PersonaArchetype | undefined,
        toPersona: updatedProfile.personaData.transformationPath.toPersona as PersonaArchetype | undefined,
      } : undefined,
    } : undefined;

    return {
      id: updatedProfile.id,
      userId: updatedProfile.userId,
      persona: updatedProfile.persona || {},
      personaData: mappedPersonaData,
      currentPersonaDescription,
      createdAt: updatedProfile.createdAt,
      updatedAt: updatedProfile.updatedAt,
    };
  }

  async restartQuestionnaire(userId: string): Promise<void> {
    // Delete all answers
    await this.answerRepository.delete({ userId });

    // Clear persona data (but keep basic profile)
    const profile = await this.professionalProfileService.getProfile(userId);
    await this.professionalProfileService.updatePersonaData(userId, {
      currentPersona: undefined,
      idealPersona: undefined,
      transformationPath: undefined,
      appliedPersona: false,
    });
  }

  async getPersona(userId: string): Promise<PersonaResponseDto | null> {
    const profile = await this.professionalProfileService.getProfile(userId);

    if (!profile.personaData || !profile.personaData.currentPersona) {
      return null;
    }

    const currentPersonaDescription =
      this.personaContentService.getPersonaDescription(
        profile.personaData.currentPersona as PersonaArchetype,
      );

    // Map personaData with proper types
    const mappedPersonaData = profile.personaData ? {
      ...profile.personaData,
      currentPersona: profile.personaData.currentPersona as PersonaArchetype | undefined,
      idealPersona: profile.personaData.idealPersona as PersonaArchetype | undefined,
      transformationPath: profile.personaData.transformationPath ? {
        ...profile.personaData.transformationPath,
        fromPersona: profile.personaData.transformationPath.fromPersona as PersonaArchetype | undefined,
        toPersona: profile.personaData.transformationPath.toPersona as PersonaArchetype | undefined,
      } : undefined,
    } : undefined;

    return {
      id: profile.id,
      userId: profile.userId,
      persona: profile.persona || {},
      personaData: mappedPersonaData,
      currentPersonaDescription,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
