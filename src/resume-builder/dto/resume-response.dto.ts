import { ApiProperty } from '@nestjs/swagger';
import { ConversationStatus } from '../enums/conversation-status.enum';
import { MessageRole } from '../enums/message-role.enum';
import { PaginatedResponseDto, PaginationMetaDto } from './pagination.dto';

export class ResumeMessageResponseDto {
  @ApiProperty({ description: 'Message ID', example: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Message role',
    enum: MessageRole,
    example: MessageRole.User,
  })
  role: MessageRole;

  @ApiProperty({
    description: 'Message content',
    example: 'I have 5 years of experience',
  })
  content: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class ResumeConversationResponseDto {
  @ApiProperty({ description: 'Conversation ID', example: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Conversation title',
    nullable: true,
    example: 'My Resume',
  })
  title: string | null;

  @ApiProperty({
    description: 'Conversation status',
    enum: ConversationStatus,
    example: ConversationStatus.Active,
  })
  status: ConversationStatus;

  @ApiProperty({
    description: 'Target job title',
    nullable: true,
    example: 'Software Engineer',
  })
  targetJobTitle: string | null;

  @ApiProperty({
    description: 'Target industry',
    nullable: true,
    example: 'Technology',
  })
  targetIndustry: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({
    description: 'List of messages',
    type: [ResumeMessageResponseDto],
    required: false,
  })
  messages?: ResumeMessageResponseDto[];
}

export class ResumeResponseDto {
  @ApiProperty({ description: 'Resume ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Conversation ID', example: 'uuid' })
  conversationId: string;

  @ApiProperty({
    description: 'Resume content as structured JSON',
    type: 'object',
    additionalProperties: true,
    example: {
      contact: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1 555-123-4567',
        location: 'Austin, TX, USA',
        links: { linkedIn: 'https://linkedin.com/in/janedoe' },
      },
      summary: 'Product manager with 8+ years...',
      workExperience: [
        {
          jobTitle: 'Senior Product Manager',
          company: 'Acme Corp',
          startDate: '2021-03',
          endDate: 'Present',
          achievements: ['Scaled...', 'Improved...'],
          tools: ['Jira', 'Figma'],
        },
      ],
      education: [
        {
          degree: 'B.Sc. Computer Science',
          institution: 'UT Austin',
          graduationYear: 2016,
        },
      ],
      skills: {
        core: ['Product Strategy', 'A/B Testing'],
        tools: ['Figma', 'SQL'],
      },
      projects: [
        {
          name: 'Launch X',
          description: '....',
          technologies: ['React', 'Node.js'],
        },
      ],
    },
  })
  content: Record<string, any>;

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
