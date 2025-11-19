import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCareerConversationDto {
  @ApiProperty({ description: 'Conversation title', required: false, example: 'Career Discovery' })
  @IsOptional()
  @IsString()
  title?: string;
}

