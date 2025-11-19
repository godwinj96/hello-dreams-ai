import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { ResumeBuilderService } from './resume-builder.service';
import { CreateResumeConversationDto } from './dto/create-conversation.dto';
import { SendResumeMessageDto } from './dto/send-message.dto';
import { UpdateResumeConversationDto } from './dto/update-conversation.dto';
import {
  ResumeConversationResponseDto,
  ResumeMessageResponseDto,
  ResumeResponseDto,
  PaginatedConversationsResponseDto,
  ConversationWithPaginatedMessagesDto,
} from './dto/resume-response.dto';
import { PaginationQueryDto } from './dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('resume-builder')
@ApiBearerAuth('JWT-auth')
@Controller('resume-builder')
@UseGuards(JwtAuthGuard)
export class ResumeBuilderController {
  constructor(private readonly resumeBuilderService: ResumeBuilderService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new resume conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created successfully', type: ResumeConversationResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: CreateResumeConversationDto })
  async createConversation(
    @Request() req,
    @Body() createDto: CreateResumeConversationDto,
  ): Promise<ResumeConversationResponseDto> {
    return this.resumeBuilderService.createConversation(req.user.id, createDto);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'Get all resume conversations for the current user',
    description: 'Returns a paginated list of conversations. Use query parameters `page` and `limit` to control pagination. Default: page=1, limit=10.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-indexed). Default: 1', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page. Default: 10, Max: 100', example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of conversations',
    type: PaginatedConversationsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAllConversations(
    @Request() req,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedConversationsResponseDto> {
    return this.resumeBuilderService.findAllConversations(req.user.id, pagination);
  }

  @Get('conversations/:id')
  @ApiOperation({
    summary: 'Get a specific resume conversation by ID',
    description: 'Returns conversation details with messages. Optionally paginate messages using query parameters `page` and `limit`. If pagination is not provided, all messages are returned (backward compatible).',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for messages (1-indexed). If provided, messages will be paginated. Default: all messages returned', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of messages per page. Default: 10, Max: 100. Only used if page is provided', example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Conversation details with paginated messages (if pagination params provided)',
    type: ConversationWithPaginatedMessagesDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOneConversation(
    @Param('id') id: string,
    @Request() req,
    @Query() messagesPagination?: PaginationQueryDto,
  ): Promise<ConversationWithPaginatedMessagesDto> {
    // Only pass pagination if at least one param is provided
    const pagination = messagesPagination?.page || messagesPagination?.limit
      ? messagesPagination
      : undefined;
    return this.resumeBuilderService.findOneConversation(id, req.user.id, pagination);
  }

  @Put('conversations/:id')
  @ApiOperation({ summary: 'Update a resume conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation updated successfully', type: ResumeConversationResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: UpdateResumeConversationDto })
  async updateConversation(
    @Param('id') id: string,
    @Request() req,
    @Body() updateDto: UpdateResumeConversationDto,
  ): Promise<ResumeConversationResponseDto> {
    return this.resumeBuilderService.updateConversation(
      id,
      req.user.id,
      updateDto,
    );
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resume conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteConversation(
    @Param('id') id: string,
    @Request() req,
  ): Promise<void> {
    return this.resumeBuilderService.deleteConversation(id, req.user.id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a resume conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Message sent and AI response received', type: ResumeMessageResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: SendResumeMessageDto })
  async sendMessage(
    @Param('id') conversationId: string,
    @Request() req,
    @Body() sendDto: SendResumeMessageDto,
  ): Promise<ResumeMessageResponseDto> {
    return this.resumeBuilderService.sendMessage(
      conversationId,
      req.user.id,
      sendDto,
    );
  }

  @Get('conversations/:id/resume')
  @ApiOperation({ summary: 'Get the generated resume for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Resume content', type: ResumeResponseDto })
  @ApiResponse({ status: 404, description: 'Resume not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getResume(
    @Param('id') conversationId: string,
    @Request() req,
  ): Promise<ResumeResponseDto> {
    return this.resumeBuilderService.getResume(conversationId, req.user.id);
  }

  @Post('conversations/:id/generate')
  @ApiOperation({ summary: 'Generate or regenerate a resume from conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Resume generated successfully', type: ResumeResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateResume(
    @Param('id') conversationId: string,
    @Request() req,
  ): Promise<ResumeResponseDto> {
    return this.resumeBuilderService.generateResume(
      conversationId,
      req.user.id,
    );
  }
}
