import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateResumeConversationDto {
  @ApiProperty({ description: 'Conversation title', required: false, example: 'My Resume' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Target job title', required: false, example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @ApiProperty({ description: 'Target industry', required: false, example: 'Technology' })
  @IsOptional()
  @IsString()
  targetIndustry?: string;
}

