import { ApiProperty } from '@nestjs/swagger';

export class CareerProfileConfirmationDto {
  @ApiProperty({ description: 'Basic information collected' })
  basicInfo: {
    name?: string;
    email?: string;
    phone?: string;
    country?: string;
    state?: string;
    city?: string;
    linkedIn?: string;
  };

  @ApiProperty({ description: 'Target job information' })
  targetJob: {
    targetJobTitle?: string;
    careerGoal?: string;
    salaryExpectation?: string;
  };

  @ApiProperty({ description: 'CV metadata (if uploaded)', required: false })
  cvMetadata?: {
    pastJobTitles?: string[];
    experienceLevel?: string;
    industries?: string[];
    keywords?: string[];
    workHistory?: Array<{
      jobTitle?: string;
      company?: string;
      duration?: string;
      responsibilities?: string[];
    }>;
  };

  @ApiProperty({ description: 'Timestamp of completion' })
  completedAt: Date;
}













