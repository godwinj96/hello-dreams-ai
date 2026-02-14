import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateResumeConversationDto {
  @ApiProperty({ description: 'Conversation title', required: false, example: 'My Resume', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @ApiProperty({ description: 'Target job title', required: false, example: 'Software Engineer', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Target job title must not exceed 200 characters' })
  targetJobTitle?: string;

  @ApiProperty({ description: 'Target industry', required: false, example: 'Technology', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Target industry must not exceed 200 characters' })
  targetIndustry?: string;
}

