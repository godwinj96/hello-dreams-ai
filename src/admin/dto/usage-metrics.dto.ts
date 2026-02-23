import { ApiProperty } from '@nestjs/swagger';

export class UsageMetricsDto {
  @ApiProperty({
    description: 'Total number of actions',
    example: 1500,
  })
  totalActions: number;

  @ApiProperty({
    description: 'Actions grouped by module',
    example: {
      'resume-builder': 500,
      'career-profile': 300,
      'document-generator': 400,
      'persona-builder': 200,
      'linkedin-optimization': 50,
      'headshot-generator': 50,
    },
  })
  actionsByModule: Record<string, number>;

  @ApiProperty({
    description: 'Actions grouped by type',
    example: {
      'conversation_created': 200,
      'message_sent': 800,
      'document_generated': 300,
      'profile_created': 200,
    },
  })
  actionsByType: Record<string, number>;

  @ApiProperty({
    description: 'Number of unique users who performed actions',
    example: 150,
  })
  uniqueUsers: number;
}






