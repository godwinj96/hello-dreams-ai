import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationStatus } from '../enums/conversation-status.enum';

export class UpdateResumeConversationDto {
  @ApiProperty({
    description: 'Conversation title',
    required: false,
    example: 'My Resume',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Conversation status',
    enum: ConversationStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiProperty({
    description: 'Target job title',
    required: false,
    example: 'Software Engineer',
  })
  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @ApiProperty({
    description: 'Target industry',
    required: false,
    example: 'Technology',
  })
  @IsOptional()
  @IsString()
  targetIndustry?: string;
}
