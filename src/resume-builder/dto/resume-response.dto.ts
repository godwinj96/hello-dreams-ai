import { ApiProperty } from '@nestjs/swagger';
import { ConversationStatus } from '../enums/conversation-status.enum';
import { MessageRole } from '../enums/message-role.enum';
import { PaginatedResponseDto, PaginationMetaDto } from './pagination.dto';

export class ResumeMessageResponseDto {
  @ApiProperty({ description: 'Message ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Message role', enum: MessageRole, example: MessageRole.User })
  role: MessageRole;

  @ApiProperty({ description: 'Message content', example: 'I have 5 years of experience' })
  content: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class ResumeConversationResponseDto {
  @ApiProperty({ description: 'Conversation ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Conversation title', nullable: true, example: 'My Resume' })
  title: string | null;

  @ApiProperty({ description: 'Conversation status', enum: ConversationStatus, example: ConversationStatus.Active })
  status: ConversationStatus;

  @ApiProperty({ description: 'Target job title', nullable: true, example: 'Software Engineer' })
  targetJobTitle: string | null;

  @ApiProperty({ description: 'Target industry', nullable: true, example: 'Technology' })
  targetIndustry: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'List of messages', type: [ResumeMessageResponseDto], required: false })
  messages?: ResumeMessageResponseDto[];
}

export class ResumeResponseDto {
  @ApiProperty({ description: 'Resume ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Conversation ID', example: 'uuid' })
  conversationId: string;

  @ApiProperty({ description: 'Resume content', example: 'FULL NAME\n...' })
  content: string;

  @ApiProperty({ description: 'Resume version', example: 1 })
  version: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PaginatedConversationsResponseDto extends PaginatedResponseDto<ResumeConversationResponseDto> {
  @ApiProperty({
    description: 'Array of conversations',
    type: [ResumeConversationResponseDto],
  })
  declare data: ResumeConversationResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetaDto })
  declare meta: PaginationMetaDto;
}

export class ConversationWithPaginatedMessagesDto extends ResumeConversationResponseDto {
  @ApiProperty({
    description: 'Pagination metadata for messages',
    type: PaginationMetaDto,
    required: false,
  })
  messagesMeta?: PaginationMetaDto;
}

