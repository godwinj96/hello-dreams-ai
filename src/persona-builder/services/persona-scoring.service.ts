import { Injectable } from '@nestjs/common';
import { PersonaArchetype } from '../enums/persona-archetype.enum';
import { PERSONA_QUESTIONS } from '../constants/persona-questions';

export interface PersonaScore {
  archetype: PersonaArchetype;
  score: number;
}

export interface PersonaScoringResult {
  currentPersona: PersonaArchetype;
  scores: PersonaScore[];
  idealPersona: PersonaArchetype;
}

@Injectable()
export class PersonaScoringService {
  /**
   * Calculate persona scores from answers
   */
  calculateScores(answers: Map<string, string>): PersonaScore[] {
    const scores = new Map<PersonaArchetype, number>();

    // Initialize scores
    Object.values(PersonaArchetype).forEach((archetype) => {
      scores.set(archetype, 0);
    });

    // Calculate scores
    PERSONA_QUESTIONS.forEach((question) => {
      const selectedOptionId = answers.get(question.id);
      if (selectedOptionId) {
        const selectedOption = question.options.find(
          (opt) => opt.id === selectedOptionId,
        );
        if (selectedOption) {
          const currentScore = scores.get(selectedOption.archetype) || 0;
          scores.set(selectedOption.archetype, currentScore + 1);
        }
      }
    });

    // Convert to array and sort by score
    return Array.from(scores.entries())
      .map(([archetype, score]) => ({ archetype, score }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Determine current persona (highest score, with tie-breaker)
   */
  determineCurrentPersona(scores: PersonaScore[]): PersonaArchetype {
    if (scores.length === 0) {
      return PersonaArchetype.Executor; // Default
    }

    const highestScore = scores[0].score;
    const topPersonas = scores.filter((s) => s.score === highestScore);

    // If there's a tie, use tie-breaker rules
    if (topPersonas.length > 1) {
      // Tie-breaker: prefer personas from questions 1, 2, or 3
      // Since we can't easily determine which questions contributed, we'll use order of enum
      // In practice, you might want to track which questions contributed to which score
      return topPersonas[0].archetype;
    }

    return topPersonas[0].archetype;
  }

  /**
   * Determine ideal persona based on target job and career aspirations
   */
  determineIdealPersona(
    targetJobTitle?: string,
    careerGoal?: string,
    developmentFocus?: string,
  ): PersonaArchetype {
    const targetLower = targetJobTitle?.toLowerCase() || '';
    const goalLower = careerGoal?.toLowerCase() || '';
    const focusLower = developmentFocus?.toLowerCase() || '';

    // Leadership roles
    if (
      targetLower.includes('lead') ||
      targetLower.includes('director') ||
      targetLower.includes('manager') ||
      targetLower.includes('head') ||
      targetLower.includes('vp') ||
      targetLower.includes('executive') ||
      goalLower.includes('lead') ||
      goalLower.includes('management')
    ) {
      return PersonaArchetype.Leader;
    }

    // Creative/product/design roles
    if (
      targetLower.includes('design') ||
      targetLower.includes('product') ||
      targetLower.includes('creative') ||
      targetLower.includes('innov') ||
      goalLower.includes('creat') ||
      goalLower.includes('innov')
    ) {
      return PersonaArchetype.Innovator;
    }

    // Operations/analyst roles
    if (
      targetLower.includes('operation') ||
      targetLower.includes('analyst') ||
      targetLower.includes('specialist') ||
      targetLower.includes('executor') ||
      goalLower.includes('expert') ||
      goalLower.includes('specialist')
    ) {
      return PersonaArchetype.Executor;
    }

    // HR/PM/customer success
    if (
      targetLower.includes('hr') ||
      targetLower.includes('human resource') ||
      targetLower.includes('project manager') ||
      targetLower.includes('customer success') ||
      targetLower.includes('people') ||
      goalLower.includes('relationship') ||
      focusLower.includes('relationship')
    ) {
      return PersonaArchetype.Collaborator;
    }

    // Default based on development focus
    if (focusLower.includes('confidence') || focusLower.includes('presence')) {
      return PersonaArchetype.Leader;
    }
    if (focusLower.includes('relationship')) {
      return PersonaArchetype.Collaborator;
    }

    // Default to Leader if unclear
    return PersonaArchetype.Leader;
  }

  /**
   * Full scoring calculation
   */
  calculatePersona(
    answers: Map<string, string>,
    targetJobTitle?: string,
    careerGoal?: string,
    developmentFocus?: string,
  ): PersonaScoringResult {
    const scores = this.calculateScores(answers);
    const currentPersona = this.determineCurrentPersona(scores);
    const idealPersona = this.determineIdealPersona(
      targetJobTitle,
      careerGoal,
      developmentFocus,
    );

    return {
      currentPersona,
      scores,
      idealPersona,
    };
  }
}














