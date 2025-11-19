import { ApiProperty } from '@nestjs/swagger';
import { ConversationStatus } from '../../resume-builder/enums/conversation-status.enum';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';

export class CareerMessageResponseDto {
  @ApiProperty({ description: 'Message ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Message role', enum: MessageRole, example: MessageRole.User })
  role: MessageRole;

  @ApiProperty({ description: 'Message content', example: 'I am interested in software engineering' })
  content: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class CareerConversationResponseDto {
  @ApiProperty({ description: 'Conversation ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Conversation title', nullable: true, example: 'Career Discovery' })
  title: string | null;

  @ApiProperty({ description: 'Conversation status', enum: ConversationStatus, example: ConversationStatus.Active })
  status: ConversationStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'List of messages', type: [CareerMessageResponseDto], required: false })
  messages?: CareerMessageResponseDto[];
}

export class ProfileSummaryResponseDto {
  @ApiProperty({ description: 'Conversation ID', example: 'uuid' })
  conversationId: string;

  @ApiProperty({ description: 'Extracted profile summary', example: { careerGoals: {}, extractedData: {} } })
  summary: {
    careerGoals?: any;
    extractedData?: any;
  };
}

