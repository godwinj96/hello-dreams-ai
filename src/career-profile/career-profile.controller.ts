import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CareerProfileService } from './career-profile.service';
import { CreateCareerConversationDto } from './dto/create-conversation.dto';
import { SendCareerMessageDto } from './dto/send-message.dto';
import { UpdateCareerConversationDto } from './dto/update-conversation.dto';
import {
  CareerConversationResponseDto,
  CareerMessageResponseDto,
  ProfileSummaryResponseDto,
} from './dto/career-profile-response.dto';
import { UploadCvResponseDto } from './dto/upload-cv.dto';
import { VoiceMessageResponseDto } from './dto/voice-message.dto';
import { CareerProfileConfirmationDto } from './dto/confirmation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UUIDValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('career-profile')
@ApiBearerAuth('JWT-auth')
@Controller('career-profile')
@UseGuards(JwtAuthGuard)
export class CareerProfileController {
  constructor(private readonly careerProfileService: CareerProfileService) {}

  @Post('conversations')
  @ApiOperation({
    summary: 'Create a new career profile conversation',
    description:
      'Creates a new conversation for career profile discovery. **You must create a conversation before sending any messages.** After creation, use the returned conversation ID to send messages to `/career-profile/conversations/:id/messages`.',
  })
  @ApiResponse({ status: 201, description: 'Conversation created successfully', type: CareerConversationResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: CreateCareerConversationDto })
  async createConversation(
    @Request() req,
    @Body() createDto: CreateCareerConversationDto,
  ): Promise<CareerConversationResponseDto> {
    return this.careerProfileService.createConversation(req.user.id, createDto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all career profile conversations for the current user' })
  @ApiResponse({ status: 200, description: 'List of conversations', type: [CareerConversationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAllConversations(
    @Request() req,
  ): Promise<CareerConversationResponseDto[]> {
    return this.careerProfileService.findAllConversations(req.user.id);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a specific career profile conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation details', type: CareerConversationResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOneConversation(
    @Param('id', UUIDValidationPipe) id: string,
    @Request() req,
  ): Promise<CareerConversationResponseDto> {
    return this.careerProfileService.findOneConversation(id, req.user.id);
  }

  @Put('conversations/:id')
  @ApiOperation({ summary: 'Update a career profile conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation updated successfully', type: CareerConversationResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: UpdateCareerConversationDto })
  async updateConversation(
    @Param('id', UUIDValidationPipe) id: string,
    @Request() req,
    @Body() updateDto: UpdateCareerConversationDto,
  ): Promise<CareerConversationResponseDto> {
    return this.careerProfileService.updateConversation(
      id,
      req.user.id,
      updateDto,
    );
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a career profile conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteConversation(
    @Param('id', UUIDValidationPipe) id: string,
    @Request() req,
  ): Promise<void> {
    return this.careerProfileService.deleteConversation(id, req.user.id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({
    summary: 'Send a message in a career profile conversation',
    description:
      'Sends a message in an existing career profile conversation and receives an AI response. **Note:** You must create a conversation first using `POST /career-profile/conversations` before you can send messages.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Message sent and AI response received', type: CareerMessageResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: SendCareerMessageDto })
  async sendMessage(
    @Param('id', UUIDValidationPipe) conversationId: string,
    @Request() req,
    @Body() sendDto: SendCareerMessageDto,
  ): Promise<CareerMessageResponseDto> {
    return this.careerProfileService.sendMessage(
      conversationId,
      req.user.id,
      sendDto,
    );
  }

  @Get('conversations/:id/summary')
  @ApiOperation({ summary: 'Get the extracted profile summary from a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Profile summary', type: ProfileSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfileSummary(
    @Param('id', UUIDValidationPipe) conversationId: string,
    @Request() req,
  ): Promise<ProfileSummaryResponseDto> {
    return this.careerProfileService.getProfileSummary(conversationId, req.user.id);
  }

  @Post('conversations/:id/upload-cv')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and parse CV/resume' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CV file (PDF or DOCX)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'CV uploaded and parsed successfully', type: UploadCvResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadCv(
    @Param('id', UUIDValidationPipe) conversationId: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadCvResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.careerProfileService.uploadCv(conversationId, req.user.id, file);
  }

  @Post('conversations/:id/voice-message')
  @UseInterceptors(FileInterceptor('audio'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Send a voice message (audio will be transcribed)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Audio file (MP3, WAV, etc.)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Voice message transcribed and processed', type: VoiceMessageResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendVoiceMessage(
    @Param('id', UUIDValidationPipe) conversationId: string,
    @Request() req,
    @UploadedFile() audioFile: Express.Multer.File,
  ): Promise<VoiceMessageResponseDto> {
    if (!audioFile) {
      throw new BadRequestException('No audio file provided');
    }
    return this.careerProfileService.sendVoiceMessage(conversationId, req.user.id, audioFile);
  }

  @Get('conversations/:id/confirmation')
  @ApiOperation({ summary: 'Get confirmation summary of collected data' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Confirmation data', type: CareerProfileConfirmationDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConfirmation(
    @Param('id', UUIDValidationPipe) conversationId: string,
    @Request() req,
  ): Promise<CareerProfileConfirmationDto> {
    return this.careerProfileService.getConfirmation(conversationId, req.user.id);
  }
}

