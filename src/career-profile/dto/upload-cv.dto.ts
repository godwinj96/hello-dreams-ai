import { ApiProperty } from '@nestjs/swagger';

export class UploadCvResponseDto {
  @ApiProperty({ description: 'CV upload URL', example: 'https://...' })
  cvUploadUrl: string;

  @ApiProperty({ description: 'Extracted CV metadata' })
  cvMetadata: {
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
}













