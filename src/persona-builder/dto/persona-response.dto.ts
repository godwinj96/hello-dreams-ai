import { ApiProperty } from '@nestjs/swagger';
import { PersonaArchetype } from '../enums/persona-archetype.enum';

export class PersonaResponseDto {
  @ApiProperty({ description: 'Profile ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User ID', example: 'uuid' })
  userId: string;

  @ApiProperty({
    description: 'Generated persona details',
    example: {
      communicationStyle: 'direct',
      tone: 'professional',
      professionalVoice: 'expert',
      writingStyle: 'concise',
      personalityTraits: ['analytical', 'strategic'],
    },
  })
  persona: {
    communicationStyle?: string;
    tone?: string;
    professionalVoice?: string;
    writingStyle?: string;
    personalityTraits?: string[];
    preferences?: Record<string, any>;
  };

  @ApiProperty({
    description: 'Persona data with current and ideal personas',
    required: false,
  })
  personaData?: {
    currentPersona?: PersonaArchetype;
    idealPersona?: PersonaArchetype;
    transformationPath?: {
      fromPersona?: PersonaArchetype;
      toPersona?: PersonaArchetype;
      playbook?: {
        speakingStyle?: string[];
        dressingForImpact?: string[];
        workplaceBehaviour?: string[];
        meetingMastery?: string[];
        digitalPresence?: string[];
      };
    };
    appliedPersona?: boolean;
  };

  @ApiProperty({ description: 'Current persona description', required: false })
  currentPersonaDescription?: {
    howPeopleSeeYou: string;
    strengths: string[];
    growthOpportunities: string[];
  };

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class QuestionOptionDto {
  @ApiProperty({ description: 'Option ID', example: '1a' })
  id: string;

  @ApiProperty({ description: 'Option text', example: 'Wait to be asked' })
  text: string;
}

export class QuestionDto {
  @ApiProperty({ description: 'Question ID', example: '1' })
  id: string;

  @ApiProperty({
    description: 'Question text',
    example: 'How would you describe your communication style?',
  })
  question: string;

  @ApiProperty({
    description: 'Question category',
    required: false,
    example: 'communication',
  })
  category?: string;

  @ApiProperty({ description: 'Answer options', type: [QuestionOptionDto] })
  options: QuestionOptionDto[];
}

export class CurrentPersonaDto {
  @ApiProperty({
    description: 'Current persona archetype',
    enum: PersonaArchetype,
  })
  archetype: PersonaArchetype;

  @ApiProperty({ description: 'How people see you' })
  howPeopleSeeYou: string;

  @ApiProperty({ description: 'Strengths', type: [String] })
  strengths: string[];

  @ApiProperty({ description: 'Growth opportunities', type: [String] })
  growthOpportunities: string[];
}

export class IdealPersonaDto {
  @ApiProperty({
    description: 'Ideal persona archetype',
    enum: PersonaArchetype,
  })
  archetype: PersonaArchetype;

  @ApiProperty({ description: 'Reason for ideal persona' })
  reason: string;
}

export class TransformationPlaybookDto {
  @ApiProperty({ description: 'Speaking style tips', type: [String] })
  speakingStyle: string[];

  @ApiProperty({ description: 'Dressing for impact tips', type: [String] })
  dressingForImpact: string[];

  @ApiProperty({ description: 'Workplace behaviour tips', type: [String] })
  workplaceBehaviour: string[];

  @ApiProperty({ description: 'Meeting mastery tips', type: [String] })
  meetingMastery: string[];

  @ApiProperty({ description: 'Digital presence tips', type: [String] })
  digitalPresence: string[];
}
