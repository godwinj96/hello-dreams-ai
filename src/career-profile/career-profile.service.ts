import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CareerConversation } from './entities/career-conversation.entity';
import { CareerMessage } from './entities/career-message.entity';
import { CreateCareerConversationDto } from './dto/create-conversation.dto';
import { SendCareerMessageDto } from './dto/send-message.dto';
import { UpdateCareerConversationDto } from './dto/update-conversation.dto';
import { ConversationStatus } from '../resume-builder/enums/conversation-status.enum';
import { MessageRole } from '../resume-builder/enums/message-role.enum';
import { AiChatService, ChatMessage } from '../resume-builder/services/ai-chat.service';
import {
  CareerConversationResponseDto,
  CareerMessageResponseDto,
  ProfileSummaryResponseDto,
} from './dto/career-profile-response.dto';
import { CareerProfileExtractorService } from './services/career-profile-extractor.service';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';

@Injectable()
export class CareerProfileService {
  private readonly logger = new Logger(CareerProfileService.name);

  constructor(
    @InjectRepository(CareerConversation)
    private conversationRepository: Repository<CareerConversation>,
    @InjectRepository(CareerMessage)
    private messageRepository: Repository<CareerMessage>,
    private aiChatService: AiChatService,
    private profileExtractor: CareerProfileExtractorService,
    private professionalProfileService: ProfessionalProfileService,
  ) {}

  async createConversation(
    userId: string,
    createDto: CreateCareerConversationDto,
  ): Promise<CareerConversationResponseDto> {
    const conversation = this.conversationRepository.create({
      userId,
      title: createDto.title || null,
      status: ConversationStatus.Active,
    } as Partial<CareerConversation>);

    const savedConversation = await this.conversationRepository.save(conversation);

    // Send initial greeting from AI
    const initialGreeting = "Hello! I'm here to help you discover and articulate your career goals and professional profile. Let's start by understanding what you're looking for in your next role. What job title or type of position are you targeting?";
    await this.addMessage(
      savedConversation.id,
      MessageRole.Assistant,
      initialGreeting,
    );

    return this.mapConversationToDto(savedConversation);
  }

  async findAllConversations(userId: string): Promise<CareerConversationResponseDto[]> {
    const conversations = await this.conversationRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      relations: ['messages'],
    });

    return conversations.map((conv) => this.mapConversationToDto(conv));
  }

  async findOneConversation(
    id: string,
    userId: string,
  ): Promise<CareerConversationResponseDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id },
      relations: ['messages'],
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return this.mapConversationToDto(conversation);
  }

  async updateConversation(
    id: string,
    userId: string,
    updateDto: UpdateCareerConversationDto,
  ): Promise<CareerConversationResponseDto> {
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
    sendDto: SendCareerMessageDto,
  ): Promise<CareerMessageResponseDto> {
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

    // Add system prompt for career profile discovery
    const systemPrompt = this.getCareerProfileSystemPrompt();
    const messagesWithSystem: ChatMessage[] = [
      { role: MessageRole.System, content: systemPrompt },
      ...chatMessages,
    ];

    // Get AI response
    let aiResponse: string;
    try {
      aiResponse = await this.aiChatService.chat(messagesWithSystem);
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

    // Extract and update profile data periodically (every few messages)
    if (messages.length % 5 === 0) {
      await this.profileExtractor.extractAndUpdateProfile(userId, messagesWithSystem);
    }

    return this.mapMessageToDto(assistantMessage);
  }

  async getProfileSummary(
    conversationId: string,
    userId: string,
  ): Promise<ProfileSummaryResponseDto> {
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

    // Get professional profile
    const profile = await this.professionalProfileService.getProfileForGeneration(userId);

    return {
      conversationId,
      summary: {
        careerGoals: profile.careerGoals,
        extractedData: profile.extractedData,
      },
    };
  }

  private async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
  ): Promise<CareerMessage> {
    const message = this.messageRepository.create({
      conversationId,
      role,
      content,
    } as Partial<CareerMessage>);

    return await this.messageRepository.save(message);
  }

  private getCareerProfileSystemPrompt(): string {
    return `You are a career discovery assistant helping users understand their career goals, aspirations, and professional profile.

Your role is to:
1. Ask thoughtful questions about their career aspirations, target roles, industries, and professional goals
2. Help them articulate their work style, values, and preferences
3. Discover their background, experience, skills, and achievements
4. Guide them to think about their future career path

Ask one question at a time and be conversational and encouraging. Focus on understanding:
- What roles/positions they're targeting
- What industries or sectors interest them
- Their career aspirations and long-term goals
- Their work style preferences
- Their values and what matters to them professionally
- Their background and experience
- Their skills and achievements
- Their education and certifications

Be warm, supportive, and help them think deeply about their career journey.`;
  }

  private mapConversationToDto(
    conversation: CareerConversation,
  ): CareerConversationResponseDto {
    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages
        ? conversation.messages.map((msg) => this.mapMessageToDto(msg))
        : undefined,
    };
  }

  private mapMessageToDto(message: CareerMessage): CareerMessageResponseDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };
  }
}

