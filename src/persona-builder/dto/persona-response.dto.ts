import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class QuestionDto {
  @ApiProperty({ description: 'Question ID', example: '1' })
  id: string;

  @ApiProperty({ description: 'Question text', example: 'How would you describe your communication style?' })
  question: string;

  @ApiProperty({ description: 'Question category', required: false, example: 'communication' })
  category?: string;
}

