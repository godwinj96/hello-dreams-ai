import {
  Controller,
  Get,
  Post,
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
import { DocumentGeneratorServiceMain } from './document-generator.service';
import { CreateDocumentConversationDto } from './dto/create-conversation.dto';
import { SendDocumentMessageDto } from './dto/send-message.dto';
import {
  DocumentConversationResponseDto,
  DocumentMessageResponseDto,
  DocumentResponseDto,
} from './dto/document-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('document-generator')
@ApiBearerAuth('JWT-auth')
@Controller('document-generator')
@UseGuards(JwtAuthGuard)
export class DocumentGeneratorController {
  constructor(
    private readonly documentGeneratorService: DocumentGeneratorServiceMain,
  ) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new document conversation (cover letter or personal statement)' })
  @ApiResponse({ status: 201, description: 'Conversation created successfully', type: DocumentConversationResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: CreateDocumentConversationDto })
  async createConversation(
    @Request() req,
    @Body() createDto: CreateDocumentConversationDto,
  ): Promise<DocumentConversationResponseDto> {
    return this.documentGeneratorService.createConversation(
      req.user.id,
      createDto,
    );
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all document conversations for the current user' })
  @ApiResponse({ status: 200, description: 'List of conversations', type: [DocumentConversationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAllConversations(
    @Request() req,
  ): Promise<DocumentConversationResponseDto[]> {
    return this.documentGeneratorService.findAllConversations(req.user.id);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a specific document conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation details', type: DocumentConversationResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOneConversation(
    @Param('id') id: string,
    @Request() req,
  ): Promise<DocumentConversationResponseDto> {
    return this.documentGeneratorService.findOneConversation(id, req.user.id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteConversation(
    @Param('id') id: string,
    @Request() req,
  ): Promise<void> {
    return this.documentGeneratorService.deleteConversation(id, req.user.id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a document conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Message sent and AI response received', type: DocumentMessageResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: SendDocumentMessageDto })
  async sendMessage(
    @Param('id') conversationId: string,
    @Request() req,
    @Body() sendDto: SendDocumentMessageDto,
  ): Promise<DocumentMessageResponseDto> {
    return this.documentGeneratorService.sendMessage(
      conversationId,
      req.user.id,
      sendDto,
    );
  }

  @Get('conversations/:id/document')
  @ApiOperation({ summary: 'Get the generated document (cover letter or personal statement)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Document content', type: DocumentResponseDto })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDocument(
    @Param('id') conversationId: string,
    @Request() req,
  ): Promise<DocumentResponseDto> {
    return this.documentGeneratorService.getDocument(conversationId, req.user.id);
  }

  @Post('conversations/:id/generate')
  @ApiOperation({ summary: 'Generate or regenerate a document from conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Document generated successfully', type: DocumentResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateDocument(
    @Param('id') conversationId: string,
    @Request() req,
  ): Promise<DocumentResponseDto> {
    return this.documentGeneratorService.generateDocument(
      conversationId,
      req.user.id,
    );
  }
}

