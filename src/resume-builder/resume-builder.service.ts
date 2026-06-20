import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResumeConversation } from './entities/resume-conversation.entity';
import { ResumeMessage } from './entities/resume-message.entity';
import { Resume } from './entities/resume.entity';
import { CreateResumeConversationDto } from './dto/create-conversation.dto';
import { SendResumeMessageDto } from './dto/send-message.dto';
import { UpdateResumeConversationDto } from './dto/update-conversation.dto';
import { ConversationStatus } from './enums/conversation-status.enum';
import { MessageRole } from './enums/message-role.enum';
import { AiChatService, ChatMessage } from './services/ai-chat.service';
import {
  ResumeGeneratorService,
  ResumeJson,
} from './services/resume-generator.service';
import {
  ResumeConversationResponseDto,
  ResumeMessageResponseDto,
  ResumeResponseDto,
  ConversationWithPaginatedMessagesDto,
} from './dto/resume-response.dto';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import {
  PaginationQueryDto,
  PaginationMetaDto,
  PaginatedResponseDto,
} from './dto/pagination.dto';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { AiCostTrackingService } from '../admin/services/ai-cost-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';
import { buildChatHistoryAfterUserMessage } from '../shared/utils/chat-history.util';
import { getResumeBuilderWelcome } from '../shared/utils/chat-welcome-messages.util';
import { ConfigService } from '@nestjs/config';
import { ContextIndexerService } from '../shared/services/context-indexer.service';
import { EmbeddingService } from '../shared/services/embedding.service';
import { UserContextEmbedding } from '../shared/entities/user-context-embedding.entity';
import { ResumeData } from './entities/resume-data.entity';

@Injectable()
export class ResumeBuilderService implements OnModuleInit {
  private readonly logger = new Logger(ResumeBuilderService.name);

  constructor(
    @InjectRepository(ResumeConversation)
    private conversationRepository: Repository<ResumeConversation>,
    @InjectRepository(ResumeMessage)
    private messageRepository: Repository<ResumeMessage>,
    @InjectRepository(Resume)
    private resumeRepository: Repository<Resume>,
    @InjectRepository(ResumeData)
    private resumeDataRepository: Repository<ResumeData>,
    @InjectRepository(UserContextEmbedding)
    private embeddingRepository: Repository<UserContextEmbedding>,
    private aiChatService: AiChatService,
    private resumeGeneratorService: ResumeGeneratorService,
    private professionalProfileService: ProfessionalProfileService,
    private usageTrackingService: UsageTrackingService,
    private aiCostTrackingService: AiCostTrackingService,
    private dashboardEventService: DashboardEventService,
    private configService: ConfigService,
    private contextIndexerService: ContextIndexerService,
    private embeddingService: EmbeddingService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    // Backfill resume_data for any existing resumes that predate this feature
    this.backfillResumeData().catch((err) =>
      this.logger.warn('ResumeData backfill failed (non-fatal)', err),
    );
  }

  // ── Public methods ───────────────────────────────────────────────────────────

  async getMyLatestResume(userId: string): Promise<Resume | null> {
    return this.resumeRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createConversation(
    userId: string,
    createDto: CreateResumeConversationDto,
  ): Promise<ResumeConversationResponseDto> {
    const conversation = this.conversationRepository.create({
      userId,
      title: createDto.title || null,
      targetJobTitle: createDto.targetJobTitle || null,
      targetIndustry: createDto.targetIndustry || null,
      status: ConversationStatus.Active,
    } as Partial<ResumeConversation>);

    const savedConversation =
      await this.conversationRepository.save(conversation);

    // Backfill any missing embeddings for this user (resumes + persona) — fire-and-forget
    this.backfillUserEmbeddings(userId).catch((err) =>
      this.logger.warn('Embedding backfill failed (non-fatal)', err),
    );

    // Check if user has basic info from career profile
    const profile = await this.professionalProfileService.getProfile(userId);
    const hasBasicInfo =
      profile.basicInfo &&
      (profile.basicInfo.name ||
        profile.basicInfo.email ||
        profile.basicInfo.phone);

    const initialGreeting = getResumeBuilderWelcome({
      hasBasicInfo: !!(hasBasicInfo && profile.basicInfo.name),
      name: profile.basicInfo?.name,
    });

    await this.addMessage(
      savedConversation.id,
      MessageRole.Assistant,
      initialGreeting,
    );

    // Track conversation creation
    this.usageTrackingService
      .trackAction(userId, 'conversation_created', 'resume-builder', {
        conversationId: savedConversation.id,
      })
      .catch((err) =>
        console.error('Failed to track conversation creation:', err),
      );
    this.dashboardEventService.emitFeatureUsed(
      userId,
      'resume-builder',
      'conversation_created',
    );

    return this.findOneConversation(savedConversation.id, userId);
  }

  async findAllConversations(
    userId: string,
    pagination?: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ResumeConversationResponseDto>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;

    const [conversations, total] =
      await this.conversationRepository.findAndCount({
        where: { userId },
        order: { updatedAt: 'DESC' },
        relations: ['messages'],
        skip,
        take: limit,
      });

    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMetaDto = {
      page,
      limit,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    };

    return {
      data: conversations.map((conv) => this.mapConversationToDto(conv)),
      meta,
    };
  }

  async findOneConversation(
    id: string,
    userId: string,
    messagesPagination?: PaginationQueryDto,
  ): Promise<ConversationWithPaginatedMessagesDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    // Get paginated messages if pagination is requested
    let messages: ResumeMessage[] = [];
    let messagesMeta: PaginationMetaDto | undefined;

    if (messagesPagination) {
      const page = messagesPagination.page || 1;
      const limit = messagesPagination.limit || 10;
      const skip = (page - 1) * limit;

      const [paginatedMessages, total] =
        await this.messageRepository.findAndCount({
          where: { conversationId: id },
          order: { createdAt: 'ASC' },
          skip,
          take: limit,
        });

      messages = paginatedMessages;

      const totalPages = Math.ceil(total / limit);
      messagesMeta = {
        page,
        limit,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      };
    } else {
      // If no pagination, return all messages (backward compatibility)
      messages = await this.messageRepository.find({
        where: { conversationId: id },
        order: { createdAt: 'ASC' },
      });
    }

    const conversationDto = this.mapConversationToDto({
      ...conversation,
      messages,
    } as ResumeConversation);

    return {
      ...conversationDto,
      messagesMeta,
    };
  }

  async updateConversation(
    id: string,
    userId: string,
    updateDto: UpdateResumeConversationDto,
  ): Promise<ResumeConversationResponseDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    Object.assign(conversation, updateDto);
    const updated = await this.conversationRepository.save(conversation);

    return this.mapConversationToDto(updated);
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    await this.conversationRepository.remove(conversation);
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    sendDto: SendResumeMessageDto,
  ): Promise<ResumeMessageResponseDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    if (conversation.status === ConversationStatus.Archived) {
      throw new ForbiddenException(
        'Cannot send messages to archived conversation',
      );
    }

    // Save user message
    const userMessage = await this.addMessage(
      conversationId,
      MessageRole.User,
      sendDto.content,
    );

    // In-memory messagesJsonb is stale after addMessage(); append current user message.
    const chatMessages = buildChatHistoryAfterUserMessage(
      conversation.messagesJsonb,
      sendDto.content,
      MessageRole.User,
    ) as ChatMessage[];

    // Build profile context block from the user's professional profile
    let profileContextBlock = '';
    try {
      const profile =
        await this.professionalProfileService.getProfileForGeneration(userId);
      const knownFields: string[] = [];

      if (profile.basicInfo) {
        if (profile.basicInfo.name)
          knownFields.push(`Name: ${profile.basicInfo.name}`);
        if (profile.basicInfo.email)
          knownFields.push(`Email: ${profile.basicInfo.email}`);
        if (profile.basicInfo.phone)
          knownFields.push(`Phone: ${profile.basicInfo.phone}`);
        const location = [
          profile.basicInfo.city,
          profile.basicInfo.state,
          profile.basicInfo.country,
        ]
          .filter(Boolean)
          .join(', ');
        if (location) knownFields.push(`Location: ${location}`);
        if (profile.basicInfo.linkedIn)
          knownFields.push(`LinkedIn: ${profile.basicInfo.linkedIn}`);
      }

      if (profile.targetJob?.targetJobTitle) {
        knownFields.push(
          `Target Job Title: ${profile.targetJob.targetJobTitle}`,
        );
        if (profile.targetJob.careerGoal)
          knownFields.push(`Career Goal: ${profile.targetJob.careerGoal}`);
      }

      if (profile.personaData?.currentPersona) {
        knownFields.push(
          `Professional Persona: ${profile.personaData.currentPersona}${profile.personaData.appliedPersona ? ' (applied)' : ''}`,
        );
      }

      if (profile.persona?.tone)
        knownFields.push(`Tone: ${profile.persona.tone}`);
      if (profile.persona?.writingStyle)
        knownFields.push(`Writing Style: ${profile.persona.writingStyle}`);

      if (knownFields.length > 0) {
        profileContextBlock = [
          '\n\n--- KNOWN USER PROFILE (already collected — do NOT ask for any of this again) ---',
          ...knownFields,
          '--- END KNOWN USER PROFILE ---',
        ].join('\n');
      }
    } catch (error) {
      this.logger.warn(
        'Could not load professional profile, continuing without it',
        error,
      );
    }

    // Semantically search the user's past content for snippets relevant to their latest message.
    // This surfaces relevant work experience or onboarding details even if mentioned in a
    // different module (e.g. career profile conversation), making the AI feel intuitive.
    let semanticContextBlock = '';
    const costAccumulator = this.aiCostTrackingService.createAccumulator();
    try {
      if (this.embeddingService.isEmbeddingsAvailable()) {
        const latestUserMessage = sendDto.content;
        const queryEmbedding =
          await this.embeddingService.generateEmbedding(latestUserMessage);
        costAccumulator.addEmbedding({
          provider: 'openai',
          model: queryEmbedding.model,
          promptTokens: queryEmbedding.usage.promptTokens,
          totalTokens: queryEmbedding.usage.totalTokens,
        });
        const allEmbeddings = await this.embeddingRepository.find({
          where: { userId },
        });

        if (allEmbeddings.length > 0) {
          const similar = this.embeddingService.findMostSimilar(
            queryEmbedding.embedding,
            allEmbeddings.map((e) => ({
              id: e.id,
              embedding: e.embedding,
              metadata: { contentType: e.contentType },
            })),
            3, // top 3 snippets
            0.65, // only high-confidence matches
          );

          if (similar.length > 0) {
            const snippets = similar
              .map(
                (s) => allEmbeddings.find((e) => e.id === s.id)?.content ?? '',
              )
              .filter(Boolean)
              .map((c) => c.substring(0, 400));

            if (snippets.length > 0) {
              semanticContextBlock =
                '\n\n--- RELEVANT PAST CONTENT (use as reference, do not re-ask) ---\n' +
                snippets.join('\n---\n') +
                '\n--- END RELEVANT CONTENT ---';
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn('Semantic context lookup failed (non-fatal)', err);
    }

    // Prepend a system message that combines the AI role instructions + known profile context
    // + semantically relevant snippets. This ensures OpenAI always gets the full context and
    // profile data is authoritative system-level info, not mixed with user input.
    const systemContent =
      this.aiChatService.getBaseSystemPrompt() +
      profileContextBlock +
      semanticContextBlock;
    const messagesWithContext: ChatMessage[] = [
      { role: MessageRole.System, content: systemContent },
      ...chatMessages,
    ];

    // Get AI response with usage tracking
    let aiResponse: string;
    let usageData: { usage: any; model: string; provider: string } | null =
      null;
    try {
      const result =
        await this.aiChatService.chatWithUsage(messagesWithContext);
      aiResponse = result.content;
      usageData = result;
    } catch (error) {
      this.logger.error('Error getting AI response', error);
      throw new Error('Failed to get AI response. Please try again.');
    }

    // Save AI response
    const assistantMessage = await this.addMessage(
      conversationId,
      MessageRole.Assistant,
      aiResponse,
    );

    // Check if AI is indicating resume generation
    const shouldGenerateResume = this.shouldGenerateResume(aiResponse);

    if (
      shouldGenerateResume &&
      conversation.status === ConversationStatus.Active
    ) {
      // Update conversation status
      conversation.status = ConversationStatus.Completed;
      await this.conversationRepository.save(conversation);

      // Generate and save resume — reuse the messagesWithContext already built above
      // (system prompt + profile context already prepended)
      try {
        await this.generateAndSaveResume(
          conversationId,
          userId,
          messagesWithContext,
        );
      } catch (error) {
        this.logger.error('Error generating resume', error);
        // Don't throw - the message was already saved
      }
    }

    if (usageData) {
      costAccumulator.addChat({
        operation: 'chat',
        provider: usageData.provider as 'openai' | 'huggingface' | 'ollama',
        model: usageData.model,
        usage: usageData.usage,
        estimated: usageData.provider !== 'openai',
      });
    }

    if (!costAccumulator.isEmpty()) {
      this.aiCostTrackingService.recordFromAccumulator(
        userId,
        'message_sent',
        'resume-builder',
        costAccumulator,
        { conversationId },
      );
    } else {
      this.aiCostTrackingService.recordFlatUsage(
        userId,
        'message_sent',
        'resume-builder',
        { conversationId },
      );
    }
    this.dashboardEventService.emitFeatureUsed(
      userId,
      'resume-builder',
      'message_sent',
    );

    return this.mapMessageToDto(assistantMessage);
  }

  async generateResume(
    conversationId: string,
    userId: string,
  ): Promise<ResumeResponseDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['messages'],
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    const chatMessages: ChatMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get professional profile for context (optional enhancement)
    let profileContext = '';
    try {
      const profile =
        await this.professionalProfileService.getProfileForGeneration(userId);
      if (profile.persona && Object.keys(profile.persona).length > 0) {
        profileContext = `\n\nUser's Professional Persona Context:
- Communication Style: ${profile.persona.communicationStyle || 'Not specified'}
- Tone: ${profile.persona.tone || 'Not specified'}
- Professional Voice: ${profile.persona.professionalVoice || 'Not specified'}
Please use this persona to inform the tone and style of the resume.`;
      }
    } catch (error) {
      this.logger.warn(
        'Could not load professional profile, continuing without it',
        error,
      );
    }

    // Add profile context to messages if available
    const messagesWithContext = profileContext
      ? [
          ...chatMessages.slice(0, -1),
          {
            ...chatMessages[chatMessages.length - 1],
            content:
              chatMessages[chatMessages.length - 1].content + profileContext,
          },
        ]
      : chatMessages;

    // Check if resume already exists
    const existingResume = await this.resumeRepository.findOne({
      where: { conversationId },
    });

    if (existingResume) {
      const costAccumulator = this.aiCostTrackingService.createAccumulator();
      const resumeContent = await this.resumeGeneratorService.generateResume(
        messagesWithContext,
        costAccumulator,
      );
      existingResume.content = resumeContent;
      existingResume.version += 1;
      const updated = await this.resumeRepository.save(existingResume);
      try {
        const indexResult = await this.contextIndexerService.indexResume(
          updated.id,
          userId,
          updated.content,
        );
        if (indexResult.embeddingUsage) {
          costAccumulator.addEmbedding({
            provider: 'openai',
            model: indexResult.embeddingUsage.model,
            promptTokens: indexResult.embeddingUsage.promptTokens,
            totalTokens: indexResult.embeddingUsage.totalTokens,
          });
        }
      } catch (err) {
        this.logger.warn('Resume re-index failed (non-fatal)', err);
      }
      this.extractAndSaveResumeData(updated.id, resumeContent).catch((err) =>
        this.logger.warn('Resume data sync failed (non-fatal)', err),
      );

      this.aiCostTrackingService.recordFromAccumulator(
        userId,
        'resume_generated',
        'resume-builder',
        costAccumulator,
        { conversationId, version: updated.version },
      );
      this.dashboardEventService.emitFeatureUsed(
        userId,
        'resume-builder',
        'resume_generated',
      );

      return this.mapResumeToDto(updated);
    }

    const result = await this.generateAndSaveResume(
      conversationId,
      userId,
      messagesWithContext,
    );
    this.dashboardEventService.emitFeatureUsed(
      userId,
      'resume-builder',
      'resume_generated',
    );
    return result;
  }

  async getResume(
    conversationId: string,
    userId: string,
  ): Promise<ResumeResponseDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    const resume = await this.resumeRepository.findOne({
      where: { conversationId },
    });

    if (!resume) {
      throw new NotFoundException(
        `Resume for conversation ${conversationId} not found`,
      );
    }

    return this.mapResumeToDto(resume);
  }

  private async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
  ): Promise<ResumeMessage> {
    const message = this.messageRepository.create({
      conversationId,
      role,
      content,
    } as Partial<ResumeMessage>);

    const saved = await this.messageRepository.save(message);

    // Append to JSONB column atomically (audit log rows are preserved)
    await this.conversationRepository.query(
      `UPDATE "resume_conversations"
       SET "messages_jsonb" = "messages_jsonb" || $1::jsonb,
           "updatedAt" = now()
       WHERE id = $2`,
      [JSON.stringify([{ role, content }]), conversationId],
    );

    return saved;
  }

  async updateResume(
    conversationId: string,
    userId: string,
    content: Record<string, any>,
  ): Promise<ResumeResponseDto> {
    const resume = await this.resumeRepository.findOne({
      where: { conversationId },
    });

    if (!resume) {
      throw new NotFoundException(
        `Resume for conversation ${conversationId} not found`,
      );
    }

    if (resume.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resume');
    }

    resume.content = content;
    resume.version += 1;
    const updated = await this.resumeRepository.save(resume);
    return this.mapResumeToDto(updated);
  }

  async patchResume(
    conversationId: string,
    userId: string,
    content?: Record<string, any>,
  ): Promise<ResumeResponseDto> {
    if (!content) {
      return this.getResume(conversationId, userId);
    }

    const existing = await this.resumeRepository.findOne({
      where: { conversationId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Resume for conversation ${conversationId} not found`,
      );
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resume');
    }

    existing.content = {
      ...(existing.content || {}),
      ...content,
    };
    existing.version += 1;
    const updated = await this.resumeRepository.save(existing);
    return this.mapResumeToDto(updated);
  }

  async deleteResume(conversationId: string, userId: string): Promise<void> {
    const resume = await this.resumeRepository.findOne({
      where: { conversationId },
    });
    if (!resume) {
      throw new NotFoundException(
        `Resume for conversation ${conversationId} not found`,
      );
    }

    if (resume.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resume');
    }

    await this.resumeRepository.remove(resume);
  }

  private async generateAndSaveResume(
    conversationId: string,
    userId: string,
    chatMessages: ChatMessage[],
  ): Promise<ResumeResponseDto> {
    const costAccumulator = this.aiCostTrackingService.createAccumulator();
    const resumeContent = await this.resumeGeneratorService.generateResume(
      chatMessages,
      costAccumulator,
    );

    const resume = this.resumeRepository.create({
      conversationId,
      userId,
      content: resumeContent,
      version: 1,
    } as Partial<Resume>);

    const saved = await this.resumeRepository.save(resume);
    try {
      const indexResult = await this.contextIndexerService.indexResume(
        saved.id,
        userId,
        saved.content,
      );
      if (indexResult.embeddingUsage) {
        costAccumulator.addEmbedding({
          provider: 'openai',
          model: indexResult.embeddingUsage.model,
          promptTokens: indexResult.embeddingUsage.promptTokens,
          totalTokens: indexResult.embeddingUsage.totalTokens,
        });
      }
    } catch (err) {
      this.logger.warn('Resume index failed (non-fatal)', err);
    }

    this.aiCostTrackingService.recordFromAccumulator(
      userId,
      'resume_generated',
      'resume-builder',
      costAccumulator,
      { conversationId, version: 1 },
    );
    // Sync resume_data for cross-module access
    this.extractAndSaveResumeData(saved.id, resumeContent).catch((err) =>
      this.logger.warn('Resume data sync failed (non-fatal)', err),
    );

    // Mark resume section as complete in professional profile
    try {
      await this.professionalProfileService.markSectionComplete(
        userId,
        'resume',
      );
    } catch (error) {
      this.logger.warn('Could not mark resume section as complete', error);
    }

    return this.mapResumeToDto(saved);
  }

  private shouldGenerateResume(aiResponse: string): boolean {
    // Check if AI is indicating it's ready to generate resume
    const indicators = [
      'I now have everything I need',
      'I will generate your',
      'Here is your resume',
      'Your resume is ready',
      'Generated resume',
    ];

    const lowerResponse = aiResponse.toLowerCase();
    return indicators.some((indicator) =>
      lowerResponse.includes(indicator.toLowerCase()),
    );
  }

  private mapConversationToDto(
    conversation: ResumeConversation,
  ): ResumeConversationResponseDto {
    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      targetJobTitle: conversation.targetJobTitle,
      targetIndustry: conversation.targetIndustry,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages
        ? conversation.messages.map((msg) => this.mapMessageToDto(msg))
        : undefined,
    };
  }

  private mapMessageToDto(message: ResumeMessage): ResumeMessageResponseDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  private mapResumeToDto(resume: Resume): ResumeResponseDto {
    return {
      id: resume.id,
      conversationId: resume.conversationId,
      content: resume.content,
      version: resume.version,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    };
  }

  /**
   * Backfill embeddings for user resumes and persona if missing
   */
  private recordStandaloneEmbedding(
    userId: string,
    usage?: { model: string; promptTokens: number; totalTokens: number },
    extra?: Record<string, unknown>,
  ): void {
    if (!usage) return;
    const acc = this.aiCostTrackingService.createAccumulator();
    acc.addEmbedding({
      provider: 'openai',
      model: usage.model,
      promptTokens: usage.promptTokens,
      totalTokens: usage.totalTokens,
    });
    this.aiCostTrackingService.recordStandalone(
      userId,
      'ai_embedding',
      'resume-builder',
      acc,
      extra,
    );
  }

  private async backfillUserEmbeddings(userId: string): Promise<void> {
    // Backfill resumes
    const resumes = await this.resumeRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    for (const resume of resumes) {
      const exists = await this.embeddingRepository.findOne({
        where: { userId, contentType: 'resume', contentId: resume.id },
      });
      if (!exists) {
        const resumeData = await this.resumeDataRepository.findOne({
          where: { resumeId: resume.id },
        });
        const content = resumeData ?? resume.content;
        try {
          const result = await this.contextIndexerService.indexResume(
            resume.id,
            userId,
            content,
          );
          this.recordStandaloneEmbedding(userId, result.embeddingUsage, {
            resumeId: resume.id,
            source: 'backfill',
          });
        } catch (err) {
          this.logger.warn(`Backfill resume ${resume.id} failed`, err);
        }
      }
    }

    // Backfill persona/profile embedding if missing
    const personaEmbedding = await this.embeddingRepository.findOne({
      where: { userId, contentType: 'profile', contentId: userId },
    });
    if (!personaEmbedding) {
      const profile =
        await this.professionalProfileService.getProfileForGeneration(userId);

      // If personaData is empty here, it means the CV/resume flow is running before persona is created
      // (or it was cleared / saved under a different userId).
      if (
        (!profile.personaData || !profile.personaData.currentPersona) &&
        (!profile.personaData || !profile.personaData.idealPersona) &&
        (!profile.persona || Object.keys(profile.persona).length === 0)
      ) {
        this.logger.warn(
          'Backfill persona embedding: profile.personaData appears empty',
          {
            userId,
            hasPersona:
              !!profile.persona && Object.keys(profile.persona).length > 0,
            currentPersona: profile.personaData?.currentPersona ?? null,
            idealPersona: profile.personaData?.idealPersona ?? null,
            appliedPersona: profile.personaData?.appliedPersona ?? null,
          },
        );
      }

      try {
        const result = await this.contextIndexerService.indexPersona(userId, {
          persona: profile.persona,
          personaData: profile.personaData,
          careerGoals: profile.careerGoals,
        });
        this.recordStandaloneEmbedding(userId, result.embeddingUsage, {
          source: 'backfill',
        });
      } catch (err) {
        this.logger.warn(`Backfill persona for ${userId} failed`, err);
      }
    }
  }

  /**
   * Extract structured fields from a ResumeJson blob and persist them to the
   * resume_data table so other modules (LinkedIn, cover letter) can query them.
   */
  private async extractAndSaveResumeData(
    resumeId: string,
    content: ResumeJson,
  ): Promise<void> {
    const existing = await this.resumeDataRepository.findOne({
      where: { resumeId },
    });
    const entity = existing ?? this.resumeDataRepository.create({ resumeId });

    const contact = content.contact ?? {};
    const links = contact.links ?? {};

    entity.contactInfo = {
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      location: contact.location,
      linkedIn: links.linkedIn,
      github: links.github,
      portfolio: links.portfolio,
    };
    entity.workExperience = (content.workExperience ?? []).map((job) => ({
      jobTitle: job.jobTitle,
      company: job.company,
      location: job.location,
      startDate: job.startDate ?? '',
      endDate: job.endDate,
      responsibilities: job.responsibilities ?? [],
      achievements: job.achievements ?? [],
      tools: job.tools ?? [],
    }));
    entity.education = content.education ?? [];
    entity.skills = {
      technical: [
        ...(content.skills?.technical ?? []),
        ...(content.skills?.core ?? []),
      ],
      soft: content.skills?.soft ?? [],
      tools: content.skills?.tools ?? [],
    };
    entity.certifications = (content.certifications ?? []).map((c) => ({
      name: c.name,
      issuingOrganization: c.issuingOrganization,
      date: c.date,
    }));
    entity.projects = (content.projects ?? []).map((p) => ({
      name: p.name,
      description: p.description,
      technologies: p.technologies ?? [],
    }));
    entity.achievements = (content.achievements ?? []).map((a) => ({
      title: a.title,
      description: a.description,
      date: a.date,
    }));
    entity.summary = content.summary ?? '';
    entity.languages = (content.skills?.languages ?? []).map((lang) => ({
      language: lang,
      proficiency: '',
    }));

    await this.resumeDataRepository.save(entity);
  }

  /**
   * One-time backfill: populate resume_data for any existing resumes that have
   * none. Safe to call on every startup — only processes records with no match.
   */
  private async backfillResumeData(): Promise<void> {
    const allResumes = await this.resumeRepository.find({
      select: ['id', 'content'],
    });

    let count = 0;
    for (const resume of allResumes) {
      const exists = await this.resumeDataRepository.findOne({
        where: { resumeId: resume.id },
      });
      if (!exists && resume.content) {
        await this.extractAndSaveResumeData(
          resume.id,
          resume.content as ResumeJson,
        );
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(`Backfilled resume_data for ${count} existing resume(s)`);
    }
  }
}
