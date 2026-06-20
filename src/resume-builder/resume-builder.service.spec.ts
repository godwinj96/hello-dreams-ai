import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResumeBuilderService } from './resume-builder.service';
import { ResumeConversation } from './entities/resume-conversation.entity';
import { ResumeMessage } from './entities/resume-message.entity';
import { Resume } from './entities/resume.entity';
import { ResumeData } from './entities/resume-data.entity';
import { UserContextEmbedding } from '../shared/entities/user-context-embedding.entity';
import { AiChatService } from './services/ai-chat.service';
import { ResumeGeneratorService } from './services/resume-generator.service';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { AiCostTrackingService } from '../admin/services/ai-cost-tracking.service';
import { AiCostAccumulator } from '../shared/utils/ai-cost-accumulator';
import { DashboardEventService } from '../admin/services/dashboard-event.service';
import { ConfigService } from '@nestjs/config';
import { ContextIndexerService } from '../shared/services/context-indexer.service';
import { EmbeddingService } from '../shared/services/embedding.service';
import { ConversationStatus } from './enums/conversation-status.enum';
import { MessageRole } from './enums/message-role.enum';

describe('ResumeBuilderService sendMessage', () => {
  let service: ResumeBuilderService;
  let capturedMessages: unknown[] = [];
  let recordFromAccumulator: jest.Mock;

  const conversationId = 'conv-1';
  const userId = 'user-1';

  const mockConversation = {
    id: conversationId,
    userId,
    status: ConversationStatus.Active,
    messagesJsonb: [
      { role: MessageRole.User, content: 'Previous user message' },
      { role: MessageRole.Assistant, content: 'Previous AI reply' },
    ],
  };

  beforeEach(async () => {
    capturedMessages = [];
    recordFromAccumulator = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeBuilderService,
        {
          provide: getRepositoryToken(ResumeConversation),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockConversation),
            query: jest.fn().mockResolvedValue(undefined),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ResumeMessage),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn((data) => ({
              ...data,
              id: 'msg-id',
              createdAt: new Date(),
            })),
          },
        },
        {
          provide: getRepositoryToken(Resume),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ResumeData),
          useValue: {},
        },
        {
          provide: getRepositoryToken(UserContextEmbedding),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AiChatService,
          useValue: {
            getBaseSystemPrompt: jest.fn().mockReturnValue('System prompt'),
            chatWithUsage: jest.fn((messages) => {
              capturedMessages = messages;
              return Promise.resolve({
                content: 'AI response',
                usage: {
                  promptTokens: 10,
                  completionTokens: 5,
                  totalTokens: 15,
                },
                model: 'gpt-4',
                provider: 'openai',
              });
            }),
          },
        },
        {
          provide: ResumeGeneratorService,
          useValue: {},
        },
        {
          provide: ProfessionalProfileService,
          useValue: {
            getProfileForGeneration: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: UsageTrackingService,
          useValue: {
            trackUsageWithCosts: jest.fn().mockResolvedValue(undefined),
            trackAction: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AiCostTrackingService,
          useValue: {
            createAccumulator: jest.fn(() => new AiCostAccumulator(1500)),
            recordFromAccumulator,
          },
        },
        {
          provide: DashboardEventService,
          useValue: {
            emitFeatureUsed: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(1500),
          },
        },
        {
          provide: ContextIndexerService,
          useValue: {},
        },
        {
          provide: EmbeddingService,
          useValue: {
            isEmbeddingsAvailable: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    service = module.get(ResumeBuilderService);
  });

  it('includes the latest user message in AI context after addMessage', async () => {
    const newContent = 'Brand new user message';

    await service.sendMessage(conversationId, userId, { content: newContent });

    const userMessages = (
      capturedMessages as Array<{ role: string; content: string }>
    ).filter((m) => m.role === MessageRole.User);

    expect(userMessages.length).toBeGreaterThan(0);
    expect(userMessages[userMessages.length - 1].content).toBe(newContent);
    expect(recordFromAccumulator).toHaveBeenCalledTimes(1);
    expect(recordFromAccumulator.mock.calls[0][1]).toBe('message_sent');
  });
});
