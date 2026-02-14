import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
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
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { HeadshotGeneratorService } from './headshot-generator.service';
import { HeadshotGeneration, HeadshotStyle, HeadshotPersonaType } from './entities/headshot-generation.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UUIDValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('headshot-generator')
@ApiBearerAuth('JWT-auth')
@Controller('headshot-generator')
@UseGuards(JwtAuthGuard)
export class HeadshotGeneratorController {
  constructor(
    private readonly headshotGeneratorService: HeadshotGeneratorService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload original image for headshot generation' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'User photo/image file',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully', schema: { type: 'object', properties: { imageUrl: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadImage(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ imageUrl: string }> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const imageUrl = await this.headshotGeneratorService.uploadImage(req.user.id, file);
    return { imageUrl };
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate professional headshots',
    description:
      'Generate multiple professional headshots using HuggingFace SDXL when available, falling back to OpenAI Images if HuggingFace is not configured. Requires prior upload via `POST /headshot-generator/upload` to get `originalImageUrl`. Generated images are stored and persisted; the response returns URLs and status.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        originalImageUrl: { type: 'string' },
        style: { type: 'string', enum: Object.values(HeadshotStyle) },
        personaType: { type: 'string', enum: Object.values(HeadshotPersonaType) },
      },
      required: ['originalImageUrl', 'style'],
    },
  })
  @ApiResponse({ status: 201, description: 'Headshots generated successfully', type: HeadshotGeneration })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateHeadshots(
    @Request() req,
    @Body() body: {
      originalImageUrl: string;
      style: HeadshotStyle;
      personaType?: HeadshotPersonaType;
    },
  ): Promise<HeadshotGeneration> {
    return this.headshotGeneratorService.generateHeadshots(
      req.user.id,
      body.originalImageUrl,
      body.style,
      body.personaType,
    );
  }

  @Get('generations/:id')
  @ApiOperation({ summary: 'Get headshot generation by ID' })
  @ApiParam({ name: 'id', description: 'Generation ID' })
  @ApiResponse({ status: 200, description: 'Generation details', type: HeadshotGeneration })
  @ApiResponse({ status: 404, description: 'Generation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getGeneration(
    @Param('id', UUIDValidationPipe) id: string,
    @Request() req,
  ): Promise<HeadshotGeneration> {
    return this.headshotGeneratorService.getGeneration(id, req.user.id);
  }

  @Get('generations')
  @ApiOperation({ summary: 'Get all headshot generations for user' })
  @ApiResponse({ status: 200, description: 'List of generations', type: [HeadshotGeneration] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserGenerations(
    @Request() req,
  ): Promise<HeadshotGeneration[]> {
    return this.headshotGeneratorService.getUserGenerations(req.user.id);
  }
}

