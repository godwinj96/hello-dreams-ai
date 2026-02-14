import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCareerConversationDto {
  @ApiProperty({ description: 'Conversation title', required: false, example: 'Career Discovery' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Interaction mode', enum: ['text', 'voice'], required: false, example: 'text' })
  @IsOptional()
  @IsEnum(['text', 'voice'])
  interactionMode?: 'text' | 'voice';
}

