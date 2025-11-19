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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CareerProfileService } from './career-profile.service';
import { CreateCareerConversationDto } from './dto/create-conversation.dto';
import { SendCareerMessageDto } from './dto/send-message.dto';
import { UpdateCareerConversationDto } from './dto/update-conversation.dto';
import {
  CareerConversationResponseDto,
  CareerMessageResponseDto,
  ProfileSummaryResponseDto,
} from './dto/career-profile-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('career-profile')
@ApiBearerAuth('JWT-auth')
@Controller('career-profile')
@UseGuards(JwtAuthGuard)
export class CareerProfileController {
  constructor(private readonly careerProfileService: CareerProfileService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new career profile conversation' })
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
    @Param('id') id: string,
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
    @Param('id') id: string,
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
    @Param('id') id: string,
    @Request() req,
  ): Promise<void> {
    return this.careerProfileService.deleteConversation(id, req.user.id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a career profile conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Message sent and AI response received', type: CareerMessageResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: SendCareerMessageDto })
  async sendMessage(
    @Param('id') conversationId: string,
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
    @Param('id') conversationId: string,
    @Request() req,
  ): Promise<ProfileSummaryResponseDto> {
    return this.careerProfileService.getProfileSummary(conversationId, req.user.id);
  }
}

