import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentConversation } from './entities/document-conversation.entity';
import { DocumentMessage } from './entities/document-message.entity';
import { Document } from './entities/document.entity';
import { CreateDocumentConversationDto } from './dto/create-conversation.dto';
import { SendDocumentMessageDto } from './dto/send-message.dto';
import { ConversationStatus } from '../resume-builder/enums/conversation-status.enum';
import { MessageRole } from '../resume-builder/enums/message-role.enum';
import { DocumentType } from './enums/document-type.enum';
import { AiChatService, ChatMessage } from '../resume-builder/services/ai-chat.service';
import { DocumentGeneratorService } from './services/document-generator.service';
import {
  DocumentConversationResponseDto,
  DocumentMessageResponseDto,
  DocumentResponseDto,
} from './dto/document-response.dto';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';

@Injectable()
export class DocumentGeneratorServiceMain {
  private readonly logger = new Logger(DocumentGeneratorServiceMain.name);

  constructor(
    @InjectRepository(DocumentConversation)
    private conversationRepository: Repository<DocumentConversation>,
    @InjectRepository(DocumentMessage)
    private messageRepository: Repository<DocumentMessage>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private aiChatService: AiChatService,
    private documentGenerator: DocumentGeneratorService,
    private professionalProfileService: ProfessionalProfileService,
  ) {}

  async createConversation(
    userId: string,
    createDto: CreateDocumentConversationDto,
  ): Promise<DocumentConversationResponseDto> {
    const conversation = this.conversationRepository.create({
      userId,
      title: createDto.title || null,
      documentType: createDto.documentType,
      targetJobTitle: createDto.targetJobTitle || null,
      targetCompany: createDto.targetCompany || null,
      jobDescription: createDto.jobDescription || null,
      status: ConversationStatus.Active,
    } as Partial<DocumentConversation>);

    const savedConversation = await this.conversationRepository.save(conversation);

    // Send initial greeting from AI based on document type
    const initialGreeting = this.getInitialGreeting(createDto.documentType);
    await this.addMessage(
      savedConversation.id,
      MessageRole.Assistant,
      initialGreeting,
    );

    return this.mapConversationToDto(savedConversation);
  }

  async findAllConversations(userId: string): Promise<DocumentConversationResponseDto[]> {
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
  ): Promise<DocumentConversationResponseDto> {
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
    sendDto: SendDocumentMessageDto,
  ): Promise<DocumentMessageResponseDto> {
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

    // Get professional profile for context
    const profile = await this.professionalProfileService.getProfileForGeneration(userId);

    // Add system prompt
    const systemPrompt = this.getSystemPrompt(conversation.documentType, profile);
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

    // Check if AI is indicating document generation
    const shouldGenerateDocument = this.shouldGenerateDocument(aiResponse);

    if (shouldGenerateDocument && conversation.status === ConversationStatus.Active) {
      // Update conversation status
      conversation.status = ConversationStatus.Completed;
      await this.conversationRepository.save(conversation);

      // Generate and save document
      try {
        await this.generateAndSaveDocument(
          conversationId,
          userId,
          conversation,
          messagesWithSystem,
        );
      } catch (error) {
        this.logger.error('Error generating document', error);
        // Don't throw - the message was already saved
      }
    }

    return this.mapMessageToDto(assistantMessage);
  }

  async generateDocument(
    conversationId: string,
    userId: string,
  ): Promise<DocumentResponseDto> {
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

    // Get professional profile for context
    const profile = await this.professionalProfileService.getProfileForGeneration(userId);
    const systemPrompt = this.getSystemPrompt(conversation.documentType, profile);
    const messagesWithSystem: ChatMessage[] = [
      { role: MessageRole.System, content: systemPrompt },
      ...chatMessages,
    ];

    // Check if document already exists
    const existingDocument = await this.documentRepository.findOne({
      where: { conversationId },
    });

    if (existingDocument) {
      // Generate new version
      const documentContent = await this.documentGenerator.generateDocument(
        messagesWithSystem,
        conversation.documentType,
        userId,
        conversation.targetJobTitle || undefined,
        conversation.targetCompany || undefined,
        conversation.jobDescription || undefined,
      );
      existingDocument.content = documentContent;
      existingDocument.version += 1;
      const updated = await this.documentRepository.save(existingDocument);
      return this.mapDocumentToDto(updated);
    } else {
      // Create new document
      return await this.generateAndSaveDocument(
        conversationId,
        userId,
        conversation,
        messagesWithSystem,
      );
    }
  }

  async getDocument(
    conversationId: string,
    userId: string,
  ): Promise<DocumentResponseDto> {
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

    const document = await this.documentRepository.findOne({
      where: { conversationId },
    });

    if (!document) {
      throw new NotFoundException(
        `Document for conversation ${conversationId} not found`,
      );
    }

    return this.mapDocumentToDto(document);
  }

  private async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
  ): Promise<DocumentMessage> {
    const message = this.messageRepository.create({
      conversationId,
      role,
      content,
    } as Partial<DocumentMessage>);

    return await this.messageRepository.save(message);
  }

  private async generateAndSaveDocument(
    conversationId: string,
    userId: string,
    conversation: DocumentConversation,
    messages: ChatMessage[],
  ): Promise<DocumentResponseDto> {
    const documentContent = await this.documentGenerator.generateDocument(
      messages,
      conversation.documentType,
      userId,
      conversation.targetJobTitle || undefined,
      conversation.targetCompany || undefined,
      conversation.jobDescription || undefined,
    );

    const document = this.documentRepository.create({
      conversationId,
      userId,
      documentType: conversation.documentType,
      content: documentContent,
      version: 1,
      targetJobTitle: conversation.targetJobTitle,
      targetCompany: conversation.targetCompany,
    } as Partial<Document>);

    const saved = await this.documentRepository.save(document);

    // Mark section as complete
    if (conversation.documentType === DocumentType.CoverLetter) {
      await this.professionalProfileService.markSectionComplete(userId, 'coverLetter');
    } else {
      await this.professionalProfileService.markSectionComplete(userId, 'personalStatement');
    }

    return this.mapDocumentToDto(saved);
  }

  private shouldGenerateDocument(aiResponse: string): boolean {
    const indicators = [
      'I now have everything I need',
      'I will generate your',
      'Here is your',
      'Your document is ready',
      'Generated',
    ];

    const lowerResponse = aiResponse.toLowerCase();
    return indicators.some((indicator) =>
      lowerResponse.includes(indicator.toLowerCase()),
    );
  }

  private getInitialGreeting(documentType: DocumentType): string {
    if (documentType === DocumentType.CoverLetter) {
      return "Hello! I'm here to help you create a compelling cover letter. Let's start by gathering some information. What position are you applying for, and which company is it with?";
    } else {
      return "Hello! I'm here to help you craft a powerful personal statement. Let's start by understanding what you'd like to highlight. What is the purpose of this personal statement (e.g., graduate school application, scholarship, program admission)?";
    }
  }

  private getSystemPrompt(documentType: DocumentType, profile: any): string {
    const personaContext = profile.persona
      ? `The user's professional persona:
- Communication Style: ${profile.persona.communicationStyle || 'Not specified'}
- Tone: ${profile.persona.tone || 'Not specified'}
- Professional Voice: ${profile.persona.professionalVoice || 'Not specified'}
- Writing Style: ${profile.persona.writingStyle || 'Not specified'}

Please use this persona to inform the tone and style of the ${documentType === DocumentType.CoverLetter ? 'cover letter' : 'personal statement'}.`
      : '';

    if (documentType === DocumentType.CoverLetter) {
      return `You are a professional cover letter writer. Your task is to help users create compelling, personalized cover letters.

${personaContext}

Guidelines:
- Make the cover letter specific to the position and company
- Highlight relevant experience and skills
- Show enthusiasm and genuine interest
- Keep it concise (typically 3-4 paragraphs)
- Use professional but engaging language
- Match the tone and style to the user's persona preferences
- Include specific examples when possible

Ask questions to gather:
- Target position and company
- Key requirements from the job description
- Relevant experience and achievements
- Why they're interested in the role
- What they can bring to the company

When ready, generate a complete, polished cover letter.`;
    } else {
      return `You are a professional personal statement writer. Your task is to help users craft authentic, compelling personal statements.

${personaContext}

Guidelines:
- Make it personal and authentic
- Tell a story that connects to their goals
- Highlight relevant experiences and achievements
- Show growth and learning
- Demonstrate passion and commitment
- Use the tone and style matching the user's persona preferences
- Keep it focused and well-structured

Ask questions to gather:
- Purpose of the personal statement
- Key experiences and achievements to highlight
- Career goals and aspirations
- What makes them unique
- Why they're pursuing this path

When ready, generate a complete, polished personal statement.`;
    }
  }

  private mapConversationToDto(
    conversation: DocumentConversation,
  ): DocumentConversationResponseDto {
    return {
      id: conversation.id,
      title: conversation.title,
      documentType: conversation.documentType,
      status: conversation.status,
      targetJobTitle: conversation.targetJobTitle,
      targetCompany: conversation.targetCompany,
      jobDescription: conversation.jobDescription,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages
        ? conversation.messages.map((msg) => this.mapMessageToDto(msg))
        : undefined,
    };
  }

  private mapMessageToDto(message: DocumentMessage): DocumentMessageResponseDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  private mapDocumentToDto(document: Document): DocumentResponseDto {
    return {
      id: document.id,
      conversationId: document.conversationId,
      documentType: document.documentType,
      content: document.content,
      version: document.version,
      targetJobTitle: document.targetJobTitle,
      targetCompany: document.targetCompany,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}

