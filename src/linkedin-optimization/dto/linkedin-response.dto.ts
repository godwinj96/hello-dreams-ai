import { ApiProperty } from '@nestjs/swagger';

export class LinkedInProfileResponseDto {
  @ApiProperty({ description: 'Profile ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User ID', example: 'uuid' })
  userId: string;

  @ApiProperty({ description: 'Headline options and selected', required: false })
  headline?: {
    options?: string[];
    selected?: string;
  };

  @ApiProperty({ description: 'About section', required: false })
  about?: string;

  @ApiProperty({ description: 'Top skills', type: [String], required: false })
  topSkills?: string[];

  @ApiProperty({ description: 'Experience entries', required: false })
  experience?: Array<{
    jobTitle: string;
    company: string;
    dates?: string;
    bullets: string[];
  }>;

  @ApiProperty({ description: 'Education entries', required: false })
  education?: Array<{
    degree: string;
    institution: string;
    dates?: string;
  }>;

  @ApiProperty({ description: 'Certifications', required: false })
  certifications?: Array<{
    name: string;
    issuingOrganization?: string;
    date?: string;
  }>;

  @ApiProperty({ description: 'All skills', type: [String], required: false })
  skills?: string[];

  @ApiProperty({ description: 'Volunteering experience', required: false })
  volunteering?: Array<{
    organization: string;
    role: string;
    description?: string;
  }>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}













