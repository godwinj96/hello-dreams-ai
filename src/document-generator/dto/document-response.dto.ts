import { ApiProperty } from '@nestjs/swagger';
import { ConversationStatus } from '../../resume-builder/enums/conversation-status.enum';
import { MessageRole } from '../../resume-builder/enums/message-role.enum';
import { DocumentType } from '../enums/document-type.enum';

export class DocumentMessageResponseDto {
  @ApiProperty({ description: 'Message ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Message role', enum: MessageRole, example: MessageRole.User })
  role: MessageRole;

  @ApiProperty({ description: 'Message content', example: 'I am applying for the Software Engineer position' })
  content: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class DocumentConversationResponseDto {
  @ApiProperty({ description: 'Conversation ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Conversation title', nullable: true, example: 'Cover Letter for Software Engineer' })
  title: string | null;

  @ApiProperty({ description: 'Document type', enum: DocumentType, example: DocumentType.CoverLetter })
  documentType: DocumentType;

  @ApiProperty({ description: 'Conversation status', enum: ConversationStatus, example: ConversationStatus.Active })
  status: ConversationStatus;

  @ApiProperty({ description: 'Target job title', nullable: true, example: 'Software Engineer' })
  targetJobTitle: string | null;

  @ApiProperty({ description: 'Target company', nullable: true, example: 'Tech Corp' })
  targetCompany: string | null;

  @ApiProperty({ description: 'Job description', nullable: true, example: 'We are looking for...' })
  jobDescription: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'List of messages', type: [DocumentMessageResponseDto], required: false })
  messages?: DocumentMessageResponseDto[];
}

export class DocumentResponseDto {
  @ApiProperty({ description: 'Document ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Conversation ID', example: 'uuid' })
  conversationId: string;

  @ApiProperty({ description: 'Document type', enum: DocumentType, example: DocumentType.CoverLetter })
  documentType: DocumentType;

  @ApiProperty({
    description: 'Document content as structured JSON',
    type: 'object',
    additionalProperties: true,
    example: {
      documentType: 'coverLetter',
      meta: {
        targetRole: 'Software Engineer',
        targetCompany: 'Tech Corp',
      },
      sections: [
        {
          heading: 'Opening',
          paragraphs: ['Dear Hiring Manager, ...'],
        },
        {
          heading: 'Body',
          paragraphs: ['I led...', 'I improved...'],
        },
        {
          heading: 'Closing',
          paragraphs: ['Thank you...', 'Sincerely, Jane'],
        },
      ],
    },
  })
  content: Record<string, any>;

  @ApiProperty({ description: 'Document version', example: 1 })
  version: number;

  @ApiProperty({ description: 'Target job title', nullable: true, example: 'Software Engineer' })
  targetJobTitle: string | null;

  @ApiProperty({ description: 'Target company', nullable: true, example: 'Tech Corp' })
  targetCompany: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

