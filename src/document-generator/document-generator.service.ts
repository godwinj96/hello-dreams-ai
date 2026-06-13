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
import { getDocumentGeneratorWelcome } from '../shared/utils/chat-welcome-messages.util';
import { UpdateDocumentDto, PatchDocumentDto } from './dto/update-document.dto';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { AiCostTrackingService } from '../admin/services/ai-cost-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';
import { buildChatHistoryAfterUserMessage } from '../shared/utils/chat-history.util';
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
    private aiCostTrackingService: AiCostTrackingService,
    private dashboardEventService: DashboardEventService,
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

    // Backfill any missing embeddings for this user — fire-and-forget
    this.backfillUserEmbeddings(userId).catch((err) =>
      this.logger.warn('Embedding backfill failed (non-fatal)', err),
    );

    // Fetch profile for the user's name (used in greeting).
    // For CoverLetter, the greeting is a static string — skip the expensive
    // embedding/context build that is only needed for AI-generated greetings.
    const profile = await this.professionalProfileService.getProfileForGeneration(userId);
    const name = profile.basicInfo?.name || 'there';
    if (createDto.documentType !== DocumentType.CoverLetter) {
      // Fire-and-forget: pre-warm context for non-cover-letter AI greetings
      this.userContextService.buildComprehensiveContext(userId, createDto.jobDescription || '')
        .catch((err) => this.logger.warn('Context pre-warm failed (non-fatal)', err));
    }

    const initialGreeting = getDocumentGeneratorWelcome({
      documentType: createDto.documentType,
      name,
      hasJobDescription: !!createDto.jobDescription,
    });
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

    return this.findOneConversation(savedConversation.id, userId);
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
      order: { messages: { createdAt: 'ASC' } },
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

    // In-memory messagesJsonb is stale after addMessage(); append current user message.
    const chatMessages = buildChatHistoryAfterUserMessage(
      conversation.messagesJsonb,
      sendDto.content,
      MessageRole.User,
    ) as ChatMessage[];

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

    const costAccumulator = this.aiCostTrackingService.createAccumulator();
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
        'document-generator',
        costAccumulator,
        { conversationId },
      );
    } else {
      this.usageTrackingService
        .trackAction(userId, 'message_sent', 'document-generator', { conversationId })
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

    // For cover letters: extract targetCompany / targetJobTitle from the conversation
    // messages if they were not set when the conversation was created (which is the
    // common case when users start chatting before filling in metadata).
    if (
      conversation.documentType === DocumentType.CoverLetter &&
      (!conversation.targetCompany || !conversation.targetJobTitle)
    ) {
      const extracted = await this.extractJobInfoFromMessages(chatMessages);
      if (!conversation.targetCompany && extracted.company) {
        conversation.targetCompany = extracted.company;
      }
      if (!conversation.targetJobTitle && extracted.jobTitle) {
        conversation.targetJobTitle = extracted.jobTitle;
      }
      if (extracted.company || extracted.jobTitle) {
        await this.conversationRepository.save(conversation);
      }
    }

    // Check if document already exists
    const existingDocument = await this.documentRepository.findOne({
      where: { conversationId },
    });

    if (existingDocument) {
      // Generate new version
      const costAccumulator = this.aiCostTrackingService.createAccumulator();
      const documentContent = await this.documentGenerator.generateDocument(
        messagesWithSystem,
        conversation.documentType,
        userId,
        conversation.targetJobTitle || undefined,
        conversation.targetCompany || undefined,
        conversation.jobDescription || undefined,
        costAccumulator,
      );
      existingDocument.content = documentContent;
      existingDocument.version += 1;
      const updated = await this.documentRepository.save(existingDocument);

      try {
        const indexResult = await this.contextIndexerService.indexDocument(
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
        this.logger.warn('Document re-index failed (non-fatal)', err);
      }

      this.aiCostTrackingService.recordFromAccumulator(
        userId,
        'document_generated',
        'document-generator',
        costAccumulator,
        {
          conversationId,
          documentType: conversation.documentType,
          version: updated.version,
        },
      );
      this.dashboardEventService.emitFeatureUsed(userId, 'document-generator', 'document_generated');

      return this.mapDocumentToDto(updated);
    }

    const result = await this.generateAndSaveDocument(
      conversationId,
      userId,
      conversation,
      messagesWithSystem,
    );
    this.dashboardEventService.emitFeatureUsed(userId, 'document-generator', 'document_generated');
    return result;
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

    const saved = await this.messageRepository.save(message);

    // Append to JSONB column atomically (audit log rows are preserved)
    await this.conversationRepository.query(
      `UPDATE "document_conversations"
       SET "messages_jsonb" = "messages_jsonb" || $1::jsonb,
           "updatedAt" = now()
       WHERE id = $2`,
      [JSON.stringify([{ role, content }]), conversationId],
    );

    return saved;
  }

  private async generateAndSaveDocument(
    conversationId: string,
    userId: string,
    conversation: DocumentConversation,
    messages: ChatMessage[],
  ): Promise<DocumentResponseDto> {
    const costAccumulator = this.aiCostTrackingService.createAccumulator();
    const documentContent = await this.documentGenerator.generateDocument(
      messages,
      conversation.documentType,
      userId,
      conversation.targetJobTitle || undefined,
      conversation.targetCompany || undefined,
      conversation.jobDescription || undefined,
      costAccumulator,
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

    try {
      const indexResult = await this.contextIndexerService.indexDocument(
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
      this.logger.warn('Document index failed (non-fatal)', err);
    }

    this.aiCostTrackingService.recordFromAccumulator(
      userId,
      'document_generated',
      'document-generator',
      costAccumulator,
      { conversationId, documentType: conversation.documentType, version: 1 },
    );

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
      return `You are a professional cover letter writer having a friendly, one-on-one conversation with your client. Your goal is to gather everything you need to write them a compelling, tailored cover letter — but through natural conversation, not an interrogation.

${personaContext}

════════════════════════════════════════
ABSOLUTE RULE — ONE QUESTION PER MESSAGE
════════════════════════════════════════
Every message you send must contain EXACTLY ONE question.
Count the question marks before sending. If there is more than one, remove all but the most important one.
No exceptions.

WRONG ✗ — "What role are you applying for, and can you share the job description and your relevant experience?"
RIGHT ✓ — "What role are you applying for?"
════════════════════════════════════════

Never do this ❌: "What role are you applying for, and can you share the job description and your relevant experience?"
Always do this ✅: "What role are you applying for?" → [wait] → "And which company is this for?" → [wait] → "Do you have the job description handy? You can paste it in."

Collect these in order, one at a time:
1. What role they're applying for
2. Which company
3. The job description (ask them to paste it, or key requirements if they don't have it)
4. A relevant achievement or experience that fits the role ("What's one thing from your background that makes you a strong fit?")
5. Why they want this specific role at this specific company ("What draws you to [Company] in particular?")

Once you have enough to write a strong letter, say: "Perfect — I have everything I need. Let me write your cover letter now." Then generate it.

Guidelines for the letter itself:
- Specific to the position and company, never generic
- 3-4 focused paragraphs
- Professional but engaging language matching the user's persona
- Concrete examples over vague claims`;
    } else {
      return `You are a personal statement writer having a warm, encouraging conversation with your client. Your role is to draw out their story and experiences through thoughtful questions — not a checklist — and use what you learn to write a compelling, authentic personal statement.

${personaContext}

════════════════════════════════════════
ABSOLUTE RULE — ONE QUESTION PER MESSAGE
════════════════════════════════════════
Every message you send must contain EXACTLY ONE question.
Count the question marks before sending. If there is more than one, remove all but the most important one.
No exceptions.

WRONG ✗ — "What's the purpose of your personal statement, what experiences do you want to highlight, and what are your career goals?"
RIGHT ✓ — "What's this personal statement for — a graduate programme, scholarship, something else?"
════════════════════════════════════════

Never do this ❌: "What's the purpose of your personal statement, what experiences do you want to highlight, and what are your career goals?"
Always do this ✅: "What's this personal statement for — a graduate programme, scholarship, something else?" → [wait] → "Great. What's the main thing you want the reader to come away thinking about you?" → [wait] → "Tell me about an experience that shaped that."

Collect these in order, one at a time:
1. Purpose of the statement (application type, institution if known)
2. What they most want the reader to remember about them
3. A defining experience or achievement relevant to the application
4. Their career or academic goals
5. What makes their path or perspective distinctive ("Is there something about your journey that's a bit different or unexpected?")

Once you have a clear picture, say: "That's really compelling — I have what I need. Here's your personal statement." Then generate it.

Guidelines for the statement itself:
- Personal, authentic, and story-driven
- Connects their past to their future goals
- Shows growth, not just accomplishment
- Matches the tone and voice of the user's persona`;
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
        ? [...conversation.messages]
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            )
            .map((msg) => this.mapMessageToDto(msg))
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
   * Extracts targetJobTitle and targetCompany from the user messages in a conversation.
   * Used when these fields were not set at conversation-creation time.
   * Fires a minimal AI call; any error returns an empty result (non-fatal).
   */
  private async extractJobInfoFromMessages(
    messages: ChatMessage[],
  ): Promise<{ company?: string; jobTitle?: string }> {
    const userText = messages
      .filter((m) => m.role === MessageRole.User)
      .map((m) => m.content)
      .join('\n');

    if (!userText.trim()) return {};

    try {
      const response = await this.aiChatService.chat([
        {
          role: MessageRole.System,
          content:
            'Extract the target job title and company name from the user messages. Return ONLY a JSON object with exactly two keys: "jobTitle" and "company". Use null for any field that is not clearly mentioned.',
        },
        { role: MessageRole.User, content: userText.slice(0, 1500) },
      ]);

      const match = response.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          company:
            parsed.company && parsed.company !== 'null' && parsed.company !== ''
              ? String(parsed.company).trim()
              : undefined,
          jobTitle:
            parsed.jobTitle && parsed.jobTitle !== 'null' && parsed.jobTitle !== ''
              ? String(parsed.jobTitle).trim()
              : undefined,
        };
      }
    } catch {
      this.logger.warn('extractJobInfoFromMessages failed (non-fatal)');
    }

    return {};
  }

  /**
   * Backfill embeddings for user resumes, documents, and persona if missing
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
      'document-generator',
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
          const result = await this.contextIndexerService.indexResume(resume.id, userId, content);
          this.recordStandaloneEmbedding(userId, result.embeddingUsage, {
            resumeId: resume.id,
            source: 'backfill',
          });
        } catch (err) {
          this.logger.warn(`Backfill resume ${resume.id} failed`, err);
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
        try {
          const result = await this.contextIndexerService.indexDocument(doc.id, userId, doc.content);
          this.recordStandaloneEmbedding(userId, result.embeddingUsage, {
            documentId: doc.id,
            source: 'backfill',
          });
        } catch (err) {
          this.logger.warn(`Backfill document ${doc.id} failed`, err);
        }
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

      try {
        const result = await this.contextIndexerService.indexPersona(userId, {
          persona: profile.persona,
          personaData: profile.personaData,
          careerGoals: profile.careerGoals,
        });
        this.recordStandaloneEmbedding(userId, result.embeddingUsage, { source: 'backfill' });
      } catch (err) {
        this.logger.warn(`Backfill persona for ${userId} failed`, err);
      }
    }
  }
}

