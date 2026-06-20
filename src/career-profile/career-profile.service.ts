import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
import {
  AiChatService,
  ChatMessage,
} from '../resume-builder/services/ai-chat.service';
import { OpenAIService } from '../shared/services/openai.service';
import {
  CareerConversationResponseDto,
  CareerMessageResponseDto,
  ProfileSummaryResponseDto,
} from './dto/career-profile-response.dto';
import { CareerProfileExtractorService } from './services/career-profile-extractor.service';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import {
  getCareerProfileWelcome,
  getCvUploadConfirmation,
} from '../shared/utils/chat-welcome-messages.util';
import { ContextIndexerService } from '../shared/services/context-indexer.service';
import { VoiceService } from '../shared/services/voice.service';
import { SupabaseStorageService } from '../shared/services/supabase-storage.service';
import { CvParserService } from './services/cv-parser.service';
import { CareerProfileConfirmationDto } from './dto/confirmation.dto';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { AiCostTrackingService } from '../admin/services/ai-cost-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';
import { buildChatHistoryAfterUserMessage } from '../shared/utils/chat-history.util';
import { AiCostAccumulator } from '../shared/utils/ai-cost-accumulator';
import { addExtractionUsageToAccumulator } from '../shared/utils/ai-usage.helpers';

@Injectable()
export class CareerProfileService {
  private readonly logger = new Logger(CareerProfileService.name);

  constructor(
    @InjectRepository(CareerConversation)
    private conversationRepository: Repository<CareerConversation>,
    @InjectRepository(CareerMessage)
    private messageRepository: Repository<CareerMessage>,
    private aiChatService: AiChatService,
    private openAIService: OpenAIService,
    private profileExtractor: CareerProfileExtractorService,
    private professionalProfileService: ProfessionalProfileService,
    private voiceService: VoiceService,
    private supabaseStorageService: SupabaseStorageService,
    private cvParserService: CvParserService,
    private usageTrackingService: UsageTrackingService,
    private aiCostTrackingService: AiCostTrackingService,
    private dashboardEventService: DashboardEventService,
    private contextIndexerService: ContextIndexerService,
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

    const savedConversation =
      await this.conversationRepository.save(conversation);

    // Set interaction mode if provided
    if (createDto.interactionMode) {
      await this.professionalProfileService.setInteractionMode(
        userId,
        createDto.interactionMode,
      );
    }

    const initialGreeting = getCareerProfileWelcome();
    await this.addMessage(
      savedConversation.id,
      MessageRole.Assistant,
      initialGreeting,
    );

    // Track conversation creation
    this.usageTrackingService
      .trackAction(userId, 'conversation_created', 'career-profile', {
        conversationId: savedConversation.id,
      })
      .catch((err) =>
        console.error('Failed to track conversation creation:', err),
      );
    this.dashboardEventService.emitFeatureUsed(
      userId,
      'career-profile',
      'conversation_created',
    );

    return this.findOneConversation(savedConversation.id, userId);
  }

  async findAllConversations(
    userId: string,
  ): Promise<CareerConversationResponseDto[]> {
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
      order: { messages: { createdAt: 'ASC' } },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
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
    sendDto: SendCareerMessageDto,
  ): Promise<CareerMessageResponseDto> {
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

    // Load existing profile so the AI skips questions already answered
    const existingProfile =
      await this.professionalProfileService.getProfile(userId);
    const systemPrompt = this.getCareerProfileSystemPrompt(existingProfile);
    const messagesWithSystem: ChatMessage[] = [
      { role: MessageRole.System, content: systemPrompt },
      ...chatMessages,
    ];

    // Get AI response with usage tracking
    let aiResponse: string;
    let usageData: { usage: any; model: string; provider: string } | null =
      null;
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

    const costAccumulator = this.aiCostTrackingService.createAccumulator();

    await this.extractStructuredDataFromConversation(
      userId,
      messagesWithSystem,
      costAccumulator,
    );

    const allUserMessages = messagesWithSystem
      .filter((m) => m.role === MessageRole.User)
      .map((m) => m.content);
    try {
      const indexResult = await this.contextIndexerService.indexConversation(
        conversationId,
        userId,
        allUserMessages,
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
      this.logger.warn('Conversation embedding failed (non-fatal)', err);
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
        'career-profile',
        costAccumulator,
        { conversationId },
      );
    } else {
      this.aiCostTrackingService.recordFlatUsage(
        userId,
        'message_sent',
        'career-profile',
        { conversationId },
      );
    }
    this.dashboardEventService.emitFeatureUsed(
      userId,
      'career-profile',
      'message_sent',
    );

    return this.mapMessageToDto(assistantMessage);
  }

  async uploadCv(
    conversationId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ cvUploadUrl: string; cvMetadata: any }> {
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

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are allowed');
    }

    // Upload to Supabase
    const cvUploadUrl = await this.supabaseStorageService.uploadFile(
      file,
      'cvs',
      userId,
    );

    // Parse CV and extract metadata
    const cvMetadata = await this.cvParserService.parseCv(file, userId);

    // Save URL to profile
    await this.professionalProfileService.setCvUploadUrl(userId, cvUploadUrl);

    // Add confirmation message
    await this.addMessage(
      conversationId,
      MessageRole.Assistant,
      getCvUploadConfirmation(),
    );

    this.aiCostTrackingService.recordFlatUsage(
      userId,
      'cv_upload',
      'career-profile',
      { conversationId },
    );

    return { cvUploadUrl, cvMetadata };
  }

  async sendVoiceMessage(
    conversationId: string,
    userId: string,
    audioFile: Express.Multer.File,
  ): Promise<CareerMessageResponseDto> {
    // Transcribe audio to text
    const transcription = await this.voiceService.speechToText(audioFile);
    const voiceAccumulator = this.aiCostTrackingService.createAccumulator();
    voiceAccumulator.addSpeech({
      provider: 'openai',
      model: 'whisper-1',
      durationSeconds: transcription.durationSecondsEstimate,
      estimated: true,
    });
    this.aiCostTrackingService.recordStandalone(
      userId,
      'ai_speech_to_text',
      'career-profile',
      voiceAccumulator,
      { conversationId },
    );

    const messageDto = { content: transcription.text };
    const response = await this.sendMessage(conversationId, userId, messageDto);

    return response;
  }

  async getConfirmation(
    conversationId: string,
    userId: string,
  ): Promise<CareerProfileConfirmationDto> {
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

    const profile = await this.professionalProfileService.getProfile(userId);

    return {
      basicInfo: profile.basicInfo || {},
      targetJob: profile.targetJob || {},
      cvMetadata: profile.cvMetadata || undefined,
      completedAt: new Date(),
    };
  }

  private async extractStructuredDataFromConversation(
    userId: string,
    messages: ChatMessage[],
    costAccumulator?: AiCostAccumulator,
  ): Promise<void> {
    try {
      // Use OpenAI to extract structured data from conversation
      const conversationText = messages
        .filter((msg) => msg.role === MessageRole.User)
        .map((msg) => msg.content)
        .join('\n');

      const schema = {
        name: 'full name',
        email: 'email address',
        phone: 'phone number',
        country: 'country',
        state: 'state or province',
        city: 'city',
        linkedIn: 'LinkedIn profile URL',
        targetJobTitle: 'target job title or position',
        careerGoal: 'career goal (promotion, career switch, new field, etc.)',
        salaryExpectation: 'salary range expectation',
        workExperience: 'brief summary of work experience and years in field',
        education: 'highest education level and field of study',
        skills: 'comma-separated list of professional skills',
        background: 'overall professional background summary',
      };

      const systemPrompt = `Extract structured information from the user's responses. Return a JSON object with only the fields that are clearly mentioned: name, email, phone, country, state, city, linkedIn, targetJobTitle, careerGoal, salaryExpectation, workExperience, education, skills (comma-separated), background. Omit any field not clearly stated.`;

      const extracted = await this.openAIService.extractStructuredData(
        conversationText,
        schema,
        systemPrompt,
      );

      addExtractionUsageToAccumulator(costAccumulator, extracted);

      if (extracted?.data) {
        const data = extracted.data;
        if (
          data.name ||
          data.email ||
          data.phone ||
          data.country ||
          data.state ||
          data.city ||
          data.linkedIn
        ) {
          await this.professionalProfileService.updateBasicInfo(userId, {
            name: data.name,
            email: data.email,
            phone: data.phone,
            country: data.country,
            state: data.state,
            city: data.city,
            linkedIn: data.linkedIn,
          });
        }

        if (data.targetJobTitle || data.careerGoal || data.salaryExpectation) {
          await this.professionalProfileService.updateTargetJob(userId, {
            targetJobTitle: data.targetJobTitle,
            careerGoal: data.careerGoal,
            salaryExpectation: data.salaryExpectation,
          });
        }

        if (
          data.workExperience ||
          data.education ||
          data.skills ||
          data.background
        ) {
          await this.professionalProfileService.updateExtractedData(userId, {
            background: data.background,
            experience: data.workExperience,
            education: data.education,
            skills: data.skills
              ? Array.isArray(data.skills)
                ? data.skills.map((s: any) => String(s).trim()).filter(Boolean)
                : String(data.skills)
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean)
              : undefined,
          });
        }
      }

      // Also use the existing extractor for other data
      await this.profileExtractor.extractAndUpdateProfile(userId, messages);
    } catch (error) {
      this.logger.error('Error extracting structured data', error);
      // Don't throw - extraction is best effort
    }
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
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    // Get professional profile
    const profile =
      await this.professionalProfileService.getProfileForGeneration(userId);

    // Mark the career profile section as complete — user has generated their summary
    await this.professionalProfileService.markSectionComplete(
      userId,
      'careerProfile',
    );

    return {
      conversationId,
      summary: {
        basicInfo: profile.basicInfo,
        targetJob: profile.targetJob,
        careerGoals: profile.careerGoals,
        extractedData: profile.extractedData,
      },
    };
  }

  async completeConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation)
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    if (conversation.userId !== userId)
      throw new ForbiddenException('Access denied');
    await this.professionalProfileService.markSectionComplete(
      userId,
      'careerProfile',
    );
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

    const saved = await this.messageRepository.save(message);

    // Append to JSONB column atomically (audit log rows are preserved)
    await this.conversationRepository.query(
      `UPDATE "career_conversations"
       SET "messages_jsonb" = "messages_jsonb" || $1::jsonb,
           "updatedAt" = now()
       WHERE id = $2`,
      [JSON.stringify([{ role, content }]), conversationId],
    );

    return saved;
  }

  private getCareerProfileSystemPrompt(existingProfile?: any): string {
    // Build a "known info" block so the AI never re-asks for data already collected
    const knownParts: string[] = [];

    if (existingProfile?.basicInfo) {
      const b = existingProfile.basicInfo;
      if (b.name) knownParts.push(`Full name: ${b.name}`);
      if (b.email) knownParts.push(`Email: ${b.email}`);
      if (b.phone) knownParts.push(`Phone: ${b.phone}`);
      const location = [b.city, b.state, b.country].filter(Boolean).join(', ');
      if (location) knownParts.push(`Location: ${location}`);
      if (b.linkedIn) knownParts.push(`LinkedIn: ${b.linkedIn}`);
    }

    if (existingProfile?.targetJob) {
      const t = existingProfile.targetJob;
      if (t.targetJobTitle)
        knownParts.push(`Target job title: ${t.targetJobTitle}`);
      if (t.careerGoal) knownParts.push(`Career goal: ${t.careerGoal}`);
      if (t.salaryExpectation)
        knownParts.push(`Salary expectation: ${t.salaryExpectation}`);
    }

    if (existingProfile?.careerGoals) {
      const g = existingProfile.careerGoals;
      if (g.careerAspirations)
        knownParts.push(`Career aspirations: ${g.careerAspirations}`);
      if (g.targetRoles?.length)
        knownParts.push(`Target roles: ${g.targetRoles.join(', ')}`);
      if (g.targetIndustries?.length)
        knownParts.push(`Target industries: ${g.targetIndustries.join(', ')}`);
    }

    if (existingProfile?.cvMetadata) {
      const cv = existingProfile.cvMetadata;
      if (cv.experienceLevel)
        knownParts.push(`Experience level: ${cv.experienceLevel}`);
      if (cv.pastJobTitles?.length)
        knownParts.push(`Past job titles: ${cv.pastJobTitles.join(', ')}`);
    }

    const knownSection =
      knownParts.length > 0
        ? `\n\n--- ALREADY COLLECTED (do NOT ask for these again) ---\n${knownParts.join('\n')}\n--- END KNOWN INFO ---\n`
        : '';

    return `You are a career discovery assistant helping users understand their career goals, aspirations, and professional profile.
${knownSection}
════════════════════════════════════════
ABSOLUTE RULE — ONE QUESTION PER MESSAGE
════════════════════════════════════════
Every message you send must contain EXACTLY ONE question.
Count the question marks before sending. If there is more than one, remove all but the most important one.
No exceptions.

WRONG ✗ — "What roles are you targeting, and what industries interest you?"
RIGHT ✓ — "What kind of role are you aiming for next?"
════════════════════════════════════════

Your role is to:
1. Ask thoughtful questions about their career aspirations, target roles, industries, and professional goals
2. Help them articulate their work style, values, and preferences
3. Discover their background, experience, skills, and achievements
4. Guide them to think about their future career path

Be conversational and encouraging. Focus on understanding:
- What roles/positions they're targeting (if not already known)
- What industries or sectors interest them (if not already known)
- Their career aspirations and long-term goals (if not already known)
- Their work style preferences
- Their values and what matters to them professionally
- Their background, experience, skills, and achievements
- Their education and certifications

If a piece of information is already listed in the ALREADY COLLECTED section above, acknowledge it naturally ("I can see you're targeting [role]...") and move on to gather new information. Never ask the user to repeat something already collected.

Be warm, supportive, and help them think deeply about their career journey.

Once you have collected enough information across these areas — contact details, target role, career goals, work experience, education, and key skills — end your message with exactly this line on its own paragraph:

✅ I have enough to build your career profile. Click **"Generate Profile Summary"** below when you're ready.

Only add this line once, when you genuinely have sufficient information to build a meaningful profile. Do not add it prematurely.`;
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
        ? [...conversation.messages]
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            )
            .map((msg) => this.mapMessageToDto(msg))
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
