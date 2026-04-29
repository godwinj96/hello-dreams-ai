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
import { AiChatService, ChatMessage } from '../resume-builder/services/ai-chat.service';
import { OpenAIService } from '../shared/services/openai.service';
import {
  CareerConversationResponseDto,
  CareerMessageResponseDto,
  ProfileSummaryResponseDto,
} from './dto/career-profile-response.dto';
import { CareerProfileExtractorService } from './services/career-profile-extractor.service';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import { ContextIndexerService } from '../shared/services/context-indexer.service';
import { VoiceService } from '../shared/services/voice.service';
import { SupabaseStorageService } from '../shared/services/supabase-storage.service';
import { CvParserService } from './services/cv-parser.service';
import { CareerProfileConfirmationDto } from './dto/confirmation.dto';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';
import { calculateCost } from '../shared/utils/cost-calculator.util';
import { ConfigService } from '@nestjs/config';

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
    private dashboardEventService: DashboardEventService,
    private configService: ConfigService,
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

    const savedConversation = await this.conversationRepository.save(conversation);

    // Set interaction mode if provided
    if (createDto.interactionMode) {
      await this.professionalProfileService.setInteractionMode(userId, createDto.interactionMode);
    }

    // Send initial greeting from AI
    const initialGreeting = "Hi Dreamer! I'm here to help you discover and articulate your career goals and professional profile. Let's start by understanding what you're looking for in your next role. What job title or type of position are you targeting?";
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
      .catch((err) => console.error('Failed to track conversation creation:', err));
    this.dashboardEventService.emitFeatureUsed(userId, 'career-profile', 'conversation_created');

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

    // Get conversation history from JSONB column and append the current user message
    // so the AI and extraction both see the full context including what was just sent.
    const chatMessages: ChatMessage[] = [
      ...(conversation.messagesJsonb ?? []) as ChatMessage[],
      { role: MessageRole.User, content: sendDto.content },
    ];

    // Load existing profile so the AI skips questions already answered
    const existingProfile = await this.professionalProfileService.getProfile(userId);
    const systemPrompt = this.getCareerProfileSystemPrompt(existingProfile);
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

    // Extract and update profile data after each message (for structured collection)
    await this.extractStructuredDataFromConversation(userId, messagesWithSystem);

    // Index all user messages from this conversation so resume builder and document
    // generator can semantically search through what the user said during onboarding.
    // Fire-and-forget — never block the response on embedding latency.
    const allUserMessages = messagesWithSystem
      .filter((m) => m.role === MessageRole.User)
      .map((m) => m.content);
    this.contextIndexerService.indexConversation(conversationId, userId, allUserMessages)
      .catch((err) => this.logger.warn('Conversation embedding failed (non-fatal)', err));

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
          'career-profile',
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
        .trackAction(userId, 'message_sent', 'career-profile', {
          conversationId,
        })
        .catch((err) => console.error('Failed to track message:', err));
    }
    this.dashboardEventService.emitFeatureUsed(userId, 'career-profile', 'message_sent');

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
      throw new ForbiddenException('You do not have access to this conversation');
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
      "Great! I've uploaded and analyzed your CV. I can see your experience and will use this to personalize your journey. Is there anything else you'd like me to know about your career journey?",
    );

    return { cvUploadUrl, cvMetadata };
  }

  async sendVoiceMessage(
    conversationId: string,
    userId: string,
    audioFile: Express.Multer.File,
  ): Promise<CareerMessageResponseDto> {
    // Transcribe audio to text
    const transcribedText = await this.voiceService.speechToText(audioFile);

    // Send as regular message
    const messageDto = { content: transcribedText };
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
      throw new ForbiddenException('You do not have access to this conversation');
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

      if (extracted) {
        // Update basic info
        if (extracted.name || extracted.email || extracted.phone || extracted.country || extracted.state || extracted.city || extracted.linkedIn) {
          await this.professionalProfileService.updateBasicInfo(userId, {
            name: extracted.name,
            email: extracted.email,
            phone: extracted.phone,
            country: extracted.country,
            state: extracted.state,
            city: extracted.city,
            linkedIn: extracted.linkedIn,
          });
        }

        // Update target job
        if (extracted.targetJobTitle || extracted.careerGoal || extracted.salaryExpectation) {
          await this.professionalProfileService.updateTargetJob(userId, {
            targetJobTitle: extracted.targetJobTitle,
            careerGoal: extracted.careerGoal,
            salaryExpectation: extracted.salaryExpectation,
          });
        }

        // Update extracted background data (feeds progress tracker and downstream AI)
        if (extracted.workExperience || extracted.education || extracted.skills || extracted.background) {
          await this.professionalProfileService.updateExtractedData(userId, {
            background: extracted.background,
            experience: extracted.workExperience,
            education: extracted.education,
            skills: extracted.skills
              ? extracted.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
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
      throw new ForbiddenException('You do not have access to this conversation');
    }

    // Get professional profile
    const profile = await this.professionalProfileService.getProfileForGeneration(userId);

    // Mark the career profile section as complete — user has generated their summary
    await this.professionalProfileService.markSectionComplete(userId, 'careerProfile');

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

  async completeConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException(`Conversation ${conversationId} not found`);
    if (conversation.userId !== userId) throw new ForbiddenException('Access denied');
    await this.professionalProfileService.markSectionComplete(userId, 'careerProfile');
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
      if (t.targetJobTitle) knownParts.push(`Target job title: ${t.targetJobTitle}`);
      if (t.careerGoal) knownParts.push(`Career goal: ${t.careerGoal}`);
      if (t.salaryExpectation) knownParts.push(`Salary expectation: ${t.salaryExpectation}`);
    }

    if (existingProfile?.careerGoals) {
      const g = existingProfile.careerGoals;
      if (g.careerAspirations) knownParts.push(`Career aspirations: ${g.careerAspirations}`);
      if (g.targetRoles?.length) knownParts.push(`Target roles: ${g.targetRoles.join(', ')}`);
      if (g.targetIndustries?.length) knownParts.push(`Target industries: ${g.targetIndustries.join(', ')}`);
    }

    if (existingProfile?.cvMetadata) {
      const cv = existingProfile.cvMetadata;
      if (cv.experienceLevel) knownParts.push(`Experience level: ${cv.experienceLevel}`);
      if (cv.pastJobTitles?.length) knownParts.push(`Past job titles: ${cv.pastJobTitles.join(', ')}`);
    }

    const knownSection = knownParts.length > 0
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

