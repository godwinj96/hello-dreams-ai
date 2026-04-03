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
import { UpdateDocumentDto, PatchDocumentDto } from './dto/update-document.dto';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';
import { calculateCost } from '../shared/utils/cost-calculator.util';
import { ConfigService } from '@nestjs/config';
import { ContextIndexerService } from '../shared/services/context-indexer.service';
import { UserContextEmbedding } from '../shared/entities/user-context-embedding.entity';
import { Resume } from '../resume-builder/entities/resume.entity';
import { ResumeData } from '../resume-builder/entities/resume-data.entity';
import { UserContextService } from './services/user-context.service';

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
    private usageTrackingService: UsageTrackingService,
    private dashboardEventService: DashboardEventService,
    private configService: ConfigService,
    private contextIndexerService: ContextIndexerService,
    private userContextService: UserContextService,
    @InjectRepository(UserContextEmbedding)
    private embeddingRepository: Repository<UserContextEmbedding>,
    @InjectRepository(Resume)
    private resumeRepository: Repository<Resume>,
    @InjectRepository(ResumeData)
    private resumeDataRepository: Repository<ResumeData>,
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

    // Backfill any missing embeddings for this user (documents, resumes, persona)
    await this.backfillUserEmbeddings(userId);

    // Build context and name for greeting
    const profile = await this.professionalProfileService.getProfileForGeneration(userId);
    const name = profile.basicInfo?.name || 'there';
    const comprehensiveContext = await this.userContextService.buildComprehensiveContext(
      userId,
      createDto.jobDescription || '',
    );

    // Send initial greeting from AI based on document type
    let initialGreeting: string;
    if (createDto.documentType === DocumentType.CoverLetter) {
      if (createDto.jobDescription) {
        initialGreeting = `Hi ${name}, I see you've provided a job description. I'll analyze it and use your past resumes/documents to tailor a cover letter. I’ll start with what I know, but tell me if there are specific achievements you want highlighted.`;
      } else {
        initialGreeting = `Hi ${name}, I’ll draft a strong cover letter using what I already know about you. If you share the job description, I can make it even sharper. What role and company are you targeting?`;
      }
    } else {
      initialGreeting = this.getInitialGreeting(createDto.documentType);
    }
    await this.addMessage(
      savedConversation.id,
      MessageRole.Assistant,
      initialGreeting,
    );

    // Track conversation creation
    this.usageTrackingService
      .trackAction(userId, 'conversation_created', 'document-generator', {
        conversationId: savedConversation.id,
        documentType: createDto.documentType,
      })
      .catch((err) => console.error('Failed to track conversation creation:', err));
    this.dashboardEventService.emitFeatureUsed(userId, 'document-generator', 'conversation_created');

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

    // Get AI response with usage tracking
    let aiResponse: string;
    let usageData: { usage: any; model: string; provider: string } | null = null;
    try {
      const result = await this.aiChatService.chatWithUsage(messagesWithSystem);
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

    // Track usage with costs
    if (usageData) {
      const ngnToUsdRate = this.configService.get<number>('NGN_TO_USD_RATE', 1500);
      const costCalculation = calculateCost(
        usageData.model,
        {
          promptTokens: usageData.usage.promptTokens,
          completionTokens: usageData.usage.completionTokens,
          totalTokens: usageData.usage.totalTokens,
        },
        ngnToUsdRate,
      );

      this.usageTrackingService
        .trackUsageWithCosts(
          userId,
          'message_sent',
          'document-generator',
          costCalculation.tokensUsed,
          costCalculation.costUsd,
          costCalculation.costNgn,
          {
            conversationId,
            model: usageData.model,
            provider: usageData.provider,
          },
        )
        .catch((err) => console.error('Failed to track usage:', err));
    } else {
      // Fallback to old tracking if usage data not available
      this.usageTrackingService
        .trackAction(userId, 'message_sent', 'document-generator', {
          conversationId,
        })
        .catch((err) => console.error('Failed to track message:', err));
    }
    this.dashboardEventService.emitFeatureUsed(userId, 'document-generator', 'message_sent');

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
      
      // Index document embedding
      await this.contextIndexerService.indexDocument(updated.id, userId, updated.content);
      
      // Track document generation
      this.usageTrackingService
        .trackAction(userId, 'document_generated', 'document-generator', {
          conversationId,
          documentType: conversation.documentType,
          version: updated.version,
        })
        .catch((err) => console.error('Failed to track document generation:', err));
      this.dashboardEventService.emitFeatureUsed(userId, 'document-generator', 'document_generated');
      
      return this.mapDocumentToDto(updated);
    } else {
      // Create new document
      const result = await this.generateAndSaveDocument(
        conversationId,
        userId,
        conversation,
        messagesWithSystem,
      );
      
      // Track document generation
      this.usageTrackingService
        .trackAction(userId, 'document_generated', 'document-generator', {
          conversationId,
          documentType: conversation.documentType,
        })
        .catch((err) => console.error('Failed to track document generation:', err));
      this.dashboardEventService.emitFeatureUsed(userId, 'document-generator', 'document_generated');
      
      return result;
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

  async updateDocument(
    conversationId: string,
    userId: string,
    updateDto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const doc = await this.documentRepository.findOne({ where: { conversationId } });
    if (!doc) {
      throw new NotFoundException(`Document for conversation ${conversationId} not found`);
    }
    if (doc.userId !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }

    doc.documentType = updateDto.documentType;
    doc.content = updateDto.content;
    doc.version += 1;
    const saved = await this.documentRepository.save(doc);
    return this.mapDocumentToDto(saved);
  }

  async patchDocument(
    conversationId: string,
    userId: string,
    patchDto: PatchDocumentDto,
  ): Promise<DocumentResponseDto> {
    const doc = await this.documentRepository.findOne({ where: { conversationId } });
    if (!doc) {
      throw new NotFoundException(`Document for conversation ${conversationId} not found`);
    }
    if (doc.userId !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }

    doc.documentType = patchDto.documentType || doc.documentType;
    doc.content = {
      ...(doc.content || {}),
      ...(patchDto.content || {}),
    };
    doc.version += 1;
    const saved = await this.documentRepository.save(doc);
    return this.mapDocumentToDto(saved);
  }

  async deleteDocument(conversationId: string, userId: string): Promise<void> {
    const doc = await this.documentRepository.findOne({ where: { conversationId } });
    if (!doc) {
      throw new NotFoundException(`Document for conversation ${conversationId} not found`);
    }
    if (doc.userId !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }
    await this.documentRepository.remove(doc);
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

    // Index document embedding
    await this.contextIndexerService.indexDocument(saved.id, userId, saved.content);

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

  /**
   * Backfill embeddings for user resumes, documents, and persona if missing
   */
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
        if (resumeData) {
          await this.contextIndexerService.indexResume(resume.id, userId, resumeData);
        } else {
          await this.contextIndexerService.indexResume(resume.id, userId, resume.content);
        }
      }
    }

    // Backfill documents
    const documents = await this.documentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    for (const doc of documents) {
      const exists = await this.embeddingRepository.findOne({
        where: { userId, contentType: 'document', contentId: doc.id },
      });
      if (!exists) {
        await this.contextIndexerService.indexDocument(doc.id, userId, doc.content);
      }
    }

    // Backfill persona/profile embedding if missing
    const personaEmbedding = await this.embeddingRepository.findOne({
      where: { userId, contentType: 'profile', contentId: userId },
    });
    if (!personaEmbedding) {
      const profile = await this.professionalProfileService.getProfileForGeneration(userId);

      if (
        (!profile.personaData || !profile.personaData.currentPersona) &&
        (!profile.personaData || !profile.personaData.idealPersona) &&
        (!profile.persona || Object.keys(profile.persona).length === 0)
      ) {
        this.logger.warn('Backfill persona embedding: profile.personaData appears empty', {
          userId,
          hasPersona: !!profile.persona && Object.keys(profile.persona).length > 0,
          currentPersona: profile.personaData?.currentPersona ?? null,
          idealPersona: profile.personaData?.idealPersona ?? null,
          appliedPersona: profile.personaData?.appliedPersona ?? null,
        });
      }

      await this.contextIndexerService.indexPersona(userId, {
        persona: profile.persona,
        personaData: profile.personaData,
        careerGoals: profile.careerGoals,
      });
    }
  }
}

