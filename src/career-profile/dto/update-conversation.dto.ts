import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationStatus } from '../../resume-builder/enums/conversation-status.enum';

export class UpdateCareerConversationDto {
  @ApiProperty({
    description: 'Conversation title',
    required: false,
    example: 'Career Discovery',
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
}
