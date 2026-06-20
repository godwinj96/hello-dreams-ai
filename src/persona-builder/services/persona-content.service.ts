import { Injectable } from '@nestjs/common';
import { PersonaArchetype } from '../enums/persona-archetype.enum';

export interface PersonaDescription {
  howPeopleSeeYou: string;
  strengths: string[];
  growthOpportunities: string[];
}

export interface TransformationPlaybook {
  speakingStyle: string[];
  dressingForImpact: string[];
  workplaceBehaviour: string[];
  meetingMastery: string[];
  digitalPresence: string[];
}

@Injectable()
export class PersonaContentService {
  /**
   * Get persona description
   */
  getPersonaDescription(persona: PersonaArchetype): PersonaDescription {
    const descriptions: Record<PersonaArchetype, PersonaDescription> = {
      [PersonaArchetype.Executor]: {
        howPeopleSeeYou:
          'Structured, dependable and consistent. The person people trust to get things done right.',
        strengths: [
          'High attention to detail',
          'Reliable execution',
          'Strong work ethic',
          'Calm under pressure',
        ],
        growthOpportunities: [
          'Speaking up earlier',
          'Taking strategic initiative',
          'Building visibility for your wins',
          'Leading conversations, not just tasks',
        ],
      },
      [PersonaArchetype.Collaborator]: {
        howPeopleSeeYou:
          'Supportive, empathetic and easy to work with. You bring harmony into chaotic spaces.',
        strengths: [
          'Strong relationships',
          'Great team player',
          'Good conflict diffuser',
          'Makes people feel heard',
        ],
        growthOpportunities: [
          'Being more decisive',
          'Standing firm on your ideas',
          'Developing a bold personal brand',
          'Taking ownership publicly',
        ],
      },
      [PersonaArchetype.Innovator]: {
        howPeopleSeeYou:
          'Creative problem solver with fresh ideas. You think outside the box naturally.',
        strengths: [
          'Creativity and innovation',
          'Idea-driven problem solving',
          'Flexibility under changing conditions',
          'Natural curiosity',
        ],
        growthOpportunities: [
          'Structuring ideas for non-creative teams',
          'Learning to persuade leaders',
          'Providing practical timelines',
          'Avoiding "too many ideas, low execution"',
        ],
      },
      [PersonaArchetype.Leader]: {
        howPeopleSeeYou:
          'Bold, strategic and confident. You take initiative and provide direction.',
        strengths: [
          'Strategic thinking',
          'Assertive communication',
          'High ownership',
          'Influences people easily',
        ],
        growthOpportunities: [
          'Listening deeply',
          'Not dominating conversations',
          'Building collaboration',
          'Balancing authority with empathy',
        ],
      },
    };

    return descriptions[persona];
  }

  /**
   * Generate transformation playbook
   */
  generateTransformationPlaybook(
    fromPersona: PersonaArchetype,
    toPersona: PersonaArchetype,
  ): TransformationPlaybook {
    // If personas are the same, return amplification playbook
    if (fromPersona === toPersona) {
      return this.getAmplificationPlaybook(toPersona);
    }

    // Generate transformation-specific playbooks
    const playbooks: Record<string, TransformationPlaybook> = {
      [`${PersonaArchetype.Executor}-${PersonaArchetype.Leader}`]: {
        speakingStyle: [
          'Speak with more authority and stop softening statements',
          'Use confident language like "I recommend…" instead of "Maybe we can…"',
          'Limit over-explaining',
        ],
        dressingForImpact: [
          'Sharper, structured pieces that communicate presence',
          'Strong colours, fitted pieces, polished finishing',
        ],
        workplaceBehaviour: [
          'Volunteer for ownership roles',
          'Drive discussions instead of waiting for direction',
          'Share wins visibly and confidently',
        ],
        meetingMastery: [
          'Present at least one idea per meeting',
          'Summarize decisions confidently',
          'Offer strategic viewpoints, not just tasks',
        ],
        digitalPresence: [
          'LinkedIn headline with leadership indicators',
          'Results-driven bullet points',
          'Thought leadership posts twice monthly',
        ],
      },
      [`${PersonaArchetype.Collaborator}-${PersonaArchetype.Leader}`]: {
        speakingStyle: [
          'Assert your opinions clearly',
          'Use "I believe" and "I recommend" confidently',
          'Reduce hedging language',
        ],
        dressingForImpact: [
          'Professional attire that commands attention',
          'Bold but appropriate color choices',
        ],
        workplaceBehaviour: [
          'Take the lead on initiatives',
          'Make decisions without always seeking consensus',
          'Own your contributions publicly',
        ],
        meetingMastery: [
          'Drive agenda items',
          'Challenge ideas constructively',
          'Own the room with presence',
        ],
        digitalPresence: [
          'Executive-level LinkedIn presence',
          'Share leadership achievements',
          'Post about industry trends and insights',
        ],
      },
      [`${PersonaArchetype.Innovator}-${PersonaArchetype.Leader}`]: {
        speakingStyle: [
          'Structure ideas for executive audiences',
          'Lead with outcomes, not process',
          'Communicate vision clearly',
        ],
        dressingForImpact: [
          'Professional polish while maintaining creativity',
          'Executive presence with personal style',
        ],
        workplaceBehaviour: [
          'Execute on ideas, not just generate them',
          'Lead cross-functional initiatives',
          'Balance creativity with delivery',
        ],
        meetingMastery: [
          'Present strategic vision',
          'Influence decision-makers',
          'Bridge creative and business perspectives',
        ],
        digitalPresence: [
          'Thought leadership in your field',
          'Showcase innovative solutions with business impact',
          'Build executive brand',
        ],
      },
      [`${PersonaArchetype.Executor}-${PersonaArchetype.Collaborator}`]: {
        speakingStyle: [
          'Ask for input and feedback more',
          'Use collaborative language',
          "Build on others' ideas",
        ],
        dressingForImpact: [
          'Approachable professional style',
          'Warmer color palettes',
        ],
        workplaceBehaviour: [
          'Prioritize team relationships',
          'Share credit generously',
          'Build consensus before decisions',
        ],
        meetingMastery: [
          'Facilitate group discussions',
          'Ensure everyone is heard',
          'Create inclusive environments',
        ],
        digitalPresence: [
          'Highlight team achievements',
          'Showcase collaboration skills',
          'Build network through relationship-building',
        ],
      },
      [`${PersonaArchetype.Executor}-${PersonaArchetype.Innovator}`]: {
        speakingStyle: [
          'Frame ideas creatively',
          'Think outside traditional solutions',
          'Present multiple options',
        ],
        dressingForImpact: [
          'More expressive personal style',
          'Creative but professional',
        ],
        workplaceBehaviour: [
          'Propose innovative approaches',
          'Challenge status quo constructively',
          'Experiment with new methods',
        ],
        meetingMastery: [
          'Bring fresh perspectives',
          'Brainstorm creatively',
          'Connect disparate ideas',
        ],
        digitalPresence: [
          'Showcase creative solutions',
          'Share innovative approaches',
          'Build reputation as creative problem-solver',
        ],
      },
      [`${PersonaArchetype.Collaborator}-${PersonaArchetype.Innovator}`]: {
        speakingStyle: [
          'Present creative ideas with confidence',
          'Articulate vision clearly',
          'Connect ideas to user needs',
        ],
        dressingForImpact: [
          'Creative professional style',
          'Personal brand expression',
        ],
        workplaceBehaviour: [
          'Lead creative initiatives',
          'Push boundaries while maintaining relationships',
          'Execute on innovative ideas',
        ],
        meetingMastery: [
          'Pitch creative concepts',
          'Bridge creative and business needs',
          'Influence with innovation',
        ],
        digitalPresence: [
          'Showcase creative portfolio',
          'Share design thinking processes',
          'Build reputation as creative innovator',
        ],
      },
    };

    const playbookKey = `${fromPersona}-${toPersona}`;
    return (
      playbooks[playbookKey] ||
      this.getDefaultTransformationPlaybook(fromPersona, toPersona)
    );
  }

  /**
   * Get amplification playbook (when current = ideal)
   */
  private getAmplificationPlaybook(
    persona: PersonaArchetype,
  ): TransformationPlaybook {
    const descriptions = this.getPersonaDescription(persona);
    return {
      speakingStyle: [
        `Amplify your natural ${persona} communication style`,
        'Continue building on your strengths',
        'Maintain authentic voice while growing influence',
      ],
      dressingForImpact: [
        'Refine your professional style',
        'Ensure consistency in presentation',
      ],
      workplaceBehaviour: [
        'Double down on what makes you successful',
        'Seek opportunities to apply your strengths',
        'Mentor others in your area of expertise',
      ],
      meetingMastery: [
        'Continue leading in your natural style',
        'Share your expertise generously',
      ],
      digitalPresence: [
        'Strengthen your professional brand',
        'Share insights in your area of expertise',
      ],
    };
  }

  /**
   * Default transformation playbook
   */
  private getDefaultTransformationPlaybook(
    fromPersona: PersonaArchetype,
    toPersona: PersonaArchetype,
  ): TransformationPlaybook {
    return {
      speakingStyle: [
        `Develop ${toPersona} communication style`,
        'Practice new ways of expressing ideas',
      ],
      dressingForImpact: ['Adjust professional style to match target persona'],
      workplaceBehaviour: [
        `Adopt ${toPersona} behaviors gradually`,
        'Seek feedback and adjust',
      ],
      meetingMastery: [`Apply ${toPersona} approaches in meetings`],
      digitalPresence: [`Build ${toPersona} professional brand`],
    };
  }
}
