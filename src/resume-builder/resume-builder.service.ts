import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
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
import { ResumeGeneratorService } from './services/resume-generator.service';
import {
  ResumeConversationResponseDto,
  ResumeMessageResponseDto,
  ResumeResponseDto,
  ConversationWithPaginatedMessagesDto,
} from './dto/resume-response.dto';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import { PaginationQueryDto, PaginationMetaDto, PaginatedResponseDto } from './dto/pagination.dto';

@Injectable()
export class ResumeBuilderService {
  private readonly logger = new Logger(ResumeBuilderService.name);

  constructor(
    @InjectRepository(ResumeConversation)
    private conversationRepository: Repository<ResumeConversation>,
    @InjectRepository(ResumeMessage)
    private messageRepository: Repository<ResumeMessage>,
    @InjectRepository(Resume)
    private resumeRepository: Repository<Resume>,
    private aiChatService: AiChatService,
    private resumeGeneratorService: ResumeGeneratorService,
    private professionalProfileService: ProfessionalProfileService,
  ) {}

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

    const savedConversation = await this.conversationRepository.save(conversation);

    // Send initial greeting from AI
    const initialGreeting = "Great! Let's begin. What is your full name?";
    await this.addMessage(
      savedConversation.id,
      MessageRole.Assistant,
      initialGreeting,
    );

    return this.mapConversationToDto(savedConversation);
  }

  async findAllConversations(
    userId: string,
    pagination?: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ResumeConversationResponseDto>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const skip = (page - 1) * limit;

    const [conversations, total] = await this.conversationRepository.findAndCount({
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
      throw new ForbiddenException('You do not have access to this conversation');
    }

    // Get paginated messages if pagination is requested
    let messages: ResumeMessage[] = [];
    let messagesMeta: PaginationMetaDto | undefined;

    if (messagesPagination) {
      const page = messagesPagination.page || 1;
      const limit = messagesPagination.limit || 10;
      const skip = (page - 1) * limit;

      const [paginatedMessages, total] = await this.messageRepository.findAndCount({
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
      throw new ForbiddenException('You do not have access to this conversation');
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
      throw new ForbiddenException('You do not have access to this conversation');
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
      relations: ['messages'],
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    if (conversation.status === ConversationStatus.Archived) {
      throw new ForbiddenException('Cannot send messages to archived conversation');
    }

    // Save user message
    const userMessage = await this.addMessage(
      conversationId,
      MessageRole.User,
      sendDto.content,
    );

    // Get conversation history for context
    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    // Convert to ChatMessage format for AI service
    const chatMessages: ChatMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get AI response
    let aiResponse: string;
    try {
      aiResponse = await this.aiChatService.chat(chatMessages);
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

    if (shouldGenerateResume && conversation.status === ConversationStatus.Active) {
      // Update conversation status
      conversation.status = ConversationStatus.Completed;
      await this.conversationRepository.save(conversation);

      // Generate and save resume
      try {
        // Get professional profile for context
        let profileContext = '';
        try {
          const profile = await this.professionalProfileService.getProfileForGeneration(userId);
          if (profile.persona && Object.keys(profile.persona).length > 0) {
            profileContext = `\n\nUser's Professional Persona Context:
- Communication Style: ${profile.persona.communicationStyle || 'Not specified'}
- Tone: ${profile.persona.tone || 'Not specified'}
- Professional Voice: ${profile.persona.professionalVoice || 'Not specified'}
Please use this persona to inform the tone and style of the resume.`;
          }
        } catch (error) {
          this.logger.warn('Could not load professional profile, continuing without it', error);
        }

        const messagesWithContext = profileContext
          ? [
              ...chatMessages.slice(0, -1),
              {
                ...chatMessages[chatMessages.length - 1],
                content: chatMessages[chatMessages.length - 1].content + profileContext,
              },
            ]
          : chatMessages;

        await this.generateAndSaveResume(conversationId, userId, messagesWithContext);
      } catch (error) {
        this.logger.error('Error generating resume', error);
        // Don't throw - the message was already saved
      }
    }

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
      throw new ForbiddenException('You do not have access to this conversation');
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
      const profile = await this.professionalProfileService.getProfileForGeneration(userId);
      if (profile.persona && Object.keys(profile.persona).length > 0) {
        profileContext = `\n\nUser's Professional Persona Context:
- Communication Style: ${profile.persona.communicationStyle || 'Not specified'}
- Tone: ${profile.persona.tone || 'Not specified'}
- Professional Voice: ${profile.persona.professionalVoice || 'Not specified'}
Please use this persona to inform the tone and style of the resume.`;
      }
    } catch (error) {
      this.logger.warn('Could not load professional profile, continuing without it', error);
    }

    // Add profile context to messages if available
    const messagesWithContext = profileContext
      ? [
          ...chatMessages.slice(0, -1),
          {
            ...chatMessages[chatMessages.length - 1],
            content: chatMessages[chatMessages.length - 1].content + profileContext,
          },
        ]
      : chatMessages;

    // Check if resume already exists
    const existingResume = await this.resumeRepository.findOne({
      where: { conversationId },
    });

    if (existingResume) {
      // Generate new version
      const resumeContent = await this.resumeGeneratorService.generateResume(
        messagesWithContext,
      );
      existingResume.content = resumeContent;
      existingResume.version += 1;
      const updated = await this.resumeRepository.save(existingResume);
      return this.mapResumeToDto(updated);
    } else {
      // Create new resume
      return await this.generateAndSaveResume(conversationId, userId, messagesWithContext);
    }
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
      throw new ForbiddenException('You do not have access to this conversation');
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

    return await this.messageRepository.save(message);
  }

  private async generateAndSaveResume(
    conversationId: string,
    userId: string,
    chatMessages: ChatMessage[],
  ): Promise<ResumeResponseDto> {
    const resumeContent = await this.resumeGeneratorService.generateResume(
      chatMessages,
    );

    const resume = this.resumeRepository.create({
      conversationId,
      userId,
      content: resumeContent,
      version: 1,
    } as Partial<Resume>);

    const saved = await this.resumeRepository.save(resume);

    // Mark resume section as complete in professional profile
    try {
      await this.professionalProfileService.markSectionComplete(userId, 'resume');
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
}

