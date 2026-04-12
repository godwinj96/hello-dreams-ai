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
import { memoryStorage } from 'multer';
import { HeadshotGeneratorService } from './headshot-generator.service';
import { HeadshotGeneration, HeadshotStyle, HeadshotPersonaType } from './entities/headshot-generation.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UUIDValidationPipe } from '../common/pipes/uuid-validation.pipe';
import { GenerateHeadshotDto } from './dto/generate-headshot.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches Supabase headshot-originals bucket limit

@ApiTags('headshot-generator')
@ApiBearerAuth('JWT-auth')
@Controller('headshot-generator')
@UseGuards(JwtAuthGuard)
export class HeadshotGeneratorController {
  constructor(
    private readonly headshotGeneratorService: HeadshotGeneratorService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload original image for headshot generation',
    description: `**Step 1 of 3: Upload Original Photo**

Upload your original photo that will be used as the reference for professional headshot generation. The image is stored securely and you'll receive a URL to use in the generation step.

**Requirements:**
- File format: JPEG, PNG, or other common image formats
- Recommended: High-quality photo with clear facial features
- File size: Should be reasonable (typically < 10MB)

**Workflow:**
1. Upload image using this endpoint (multipart/form-data)
2. Save the returned \`imageUrl\` - you'll need it for generation
3. Use the \`imageUrl\` in \`POST /headshot-generator/generate\`

**Example Request:**
\`\`\`
Content-Type: multipart/form-data

image: [binary file data]
\`\`\`

**Example Response:**
\`\`\`json
{
  "imageUrl": "https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg"
}
\`\`\``,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'User photo/image file (JPEG, PNG, etc.)',
        },
      },
      required: ['image'],
    },
    examples: {
      example1: {
        summary: 'Upload headshot photo',
        description: 'Upload a professional photo to use as reference for headshot generation',
        value: {
          image: 'binary file data',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          example: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
          description: 'URL of the uploaded image. Save this for use in the generate endpoint.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or no file provided',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'No image file provided' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  async uploadImage(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ imageUrl: string; imageId: string }> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const imageUrl = await this.headshotGeneratorService.uploadImage(req.user.id, file);
    // Return both `imageUrl` (canonical) and `imageId` (frontend compatibility alias)
    return { imageUrl, imageId: imageUrl };
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate professional headshots',
    description: `**Step 2 of 3: Generate Professional Headshots**

Generate multiple professional headshot variations from your uploaded photo. The system uses advanced AI image generation with identity preservation to create professional headshots while maintaining your facial features.

**Provider Fallback System:**
The system automatically tries multiple AI providers in order:
1. **OpenAI Images Edit API** (Primary) - Direct image-to-image editing with identity preservation
2. **Gemini 2.5 Flash Image** (Fallback 1) - Multimodal AI with reference image support
3. **HuggingFace Image-to-Image** (Fallback 2) - Stable Diffusion based image transformation

If one provider fails, the system automatically tries the next. This ensures high reliability.

**Style Options:**
- \`corporate\`: Well-fitted business blazer/suit, neutral office background, polished corporate look
- \`modern\`: Smart-casual professional clothing, soft gradient background, contemporary style
- \`executive\`: Tailored dark suit/blazer, subtle textured background, premium executive styling
- \`creative\`: Stylish modern outfit, colorful/textured background, creative but polished look

**Persona Types:**
- \`confident-leader\`: Upright posture, composed presence, decisive and confident mood
- \`approachable-expert\`: Open relaxed posture, welcoming demeanor, collaborative atmosphere
- \`innovative-thinker\`: Dynamic natural pose, modern environment, forward-thinking energy
- \`trustworthy-professional\`: Steady composed posture, calm reliable presence, professional warmth

**Note:** If \`personaType\` is not provided, the system will attempt to use the persona from your professional profile, or default to \`trustworthy-professional\`.

**Generation Process:**
1. Fetches your uploaded reference image
2. Generates 4 headshot variations (default count)
3. Preserves your facial identity while applying style and persona
4. Stores generated images securely
5. Returns URLs and generation status

**Status Values:**
- \`pending\`: Generation queued
- \`processing\`: Currently generating
- \`completed\`: Successfully generated (check \`generatedImages\` array)
- \`failed\`: Generation failed (check error logs)

**Example Request:**
\`\`\`json
{
  "originalImageUrl": "https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg",
  "style": "corporate",
  "personaType": "confident-leader"
}
\`\`\`

**Example Response:**
\`\`\`json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "user-uuid",
  "originalImageUrl": "https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg",
  "style": "corporate",
  "personaType": "confident-leader",
  "generatedImages": [
    "https://supabase.co/storage/v1/object/public/headshot-generated/user-id/gen-1.jpg",
    "https://supabase.co/storage/v1/object/public/headshot-generated/user-id/gen-2.jpg",
    "https://supabase.co/storage/v1/object/public/headshot-generated/user-id/gen-3.jpg",
    "https://supabase.co/storage/v1/object/public/headshot-generated/user-id/gen-4.jpg"
  ],
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:15.000Z"
}
\`\`\``,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        originalImageUrl: {
          type: 'string',
          description: 'URL from the upload endpoint. Must be a valid Supabase storage URL.',
          example: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
        },
        style: {
          type: 'string',
          enum: Object.values(HeadshotStyle),
          description: 'Professional headshot style',
          example: HeadshotStyle.Corporate,
        },
        personaType: {
          type: 'string',
          enum: Object.values(HeadshotPersonaType),
          description: 'Professional persona type. Optional - will use profile persona or default if not provided.',
          example: HeadshotPersonaType.ConfidentLeader,
        },
      },
      required: ['originalImageUrl', 'style'],
    },
    examples: {
      corporateConfident: {
        summary: 'Corporate style with confident leader persona',
        value: {
          originalImageUrl: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
          style: 'corporate',
          personaType: 'confident-leader',
        },
      },
      modernApproachable: {
        summary: 'Modern style with approachable expert persona',
        value: {
          originalImageUrl: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
          style: 'modern',
          personaType: 'approachable-expert',
        },
      },
      executiveTrustworthy: {
        summary: 'Executive style with trustworthy professional persona',
        value: {
          originalImageUrl: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
          style: 'executive',
          personaType: 'trustworthy-professional',
        },
      },
      creativeInnovative: {
        summary: 'Creative style with innovative thinker persona',
        value: {
          originalImageUrl: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
          style: 'creative',
          personaType: 'innovative-thinker',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Headshots generated successfully',
    type: HeadshotGeneration,
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        originalImageUrl: { type: 'string' },
        style: { type: 'string', enum: Object.values(HeadshotStyle) },
        personaType: { type: 'string', enum: Object.values(HeadshotPersonaType) },
        generatedImages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of URLs to generated headshot images (typically 4 images)',
        },
        status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid image URL, missing required fields, or all providers failed',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Failed to fetch reference image: Reference image is required for professional headshot generation.',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  async generateHeadshots(
    @Request() req,
    @Body() body: GenerateHeadshotDto,
  ): Promise<HeadshotGeneration> {
    return this.headshotGeneratorService.generateHeadshots(
      req.user.id,
      body.originalImageUrl,
      body.style,
      body.personaType,
    );
  }

  @Get('generations/:id')
  @ApiOperation({
    summary: 'Get headshot generation by ID',
    description: `**Step 3 of 3: Retrieve Generation Results**

Retrieve details of a specific headshot generation by its ID. Use this to check the status of a generation or retrieve the generated image URLs.

**Use Cases:**
- Check if generation is still processing
- Retrieve generated image URLs after completion
- View generation metadata (style, persona, timestamps)

**Status Checking:**
- If \`status\` is \`processing\`, the generation is still in progress
- If \`status\` is \`completed\`, check the \`generatedImages\` array for URLs
- If \`status\` is \`failed\`, the generation encountered an error

**Example Response:**
\`\`\`json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "user-uuid",
  "originalImageUrl": "https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg",
  "style": "corporate",
  "personaType": "confident-leader",
  "generatedImages": [
    "https://supabase.co/storage/v1/object/public/headshot-generated/user-id/gen-1.jpg",
    "https://supabase.co/storage/v1/object/public/headshot-generated/user-id/gen-2.jpg",
    "https://supabase.co/storage/v1/object/public/headshot-generated/user-id/gen-3.jpg",
    "https://supabase.co/storage/v1/object/public/headshot-generated/user-id/gen-4.jpg"
  ],
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:15.000Z"
}
\`\`\``,
  })
  @ApiParam({
    name: 'id',
    description: 'Generation ID (UUID) returned from the generate endpoint',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Generation details retrieved successfully',
    type: HeadshotGeneration,
  })
  @ApiResponse({
    status: 404,
    description: 'Generation not found - Invalid ID or generation belongs to another user',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Headshot generation not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  async getGeneration(
    @Param('id', UUIDValidationPipe) id: string,
    @Request() req,
  ): Promise<HeadshotGeneration> {
    return this.headshotGeneratorService.getGeneration(id, req.user.id);
  }

  @Get('generations')
  @ApiOperation({
    summary: 'Get all headshot generations for user',
    description: `**List All Generations**

Retrieve all headshot generations for the authenticated user, ordered by creation date (newest first).

**Use Cases:**
- Display user's generation history
- Show all available headshots
- Filter by status (completed, failed, etc.) on frontend

**Response:**
Returns an array of \`HeadshotGeneration\` objects. Each object includes:
- Generation ID
- Original image URL
- Style and persona used
- Generated image URLs (if completed)
- Status
- Timestamps

**Example Response:**
\`\`\`json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "user-uuid",
    "originalImageUrl": "https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg",
    "style": "corporate",
    "personaType": "confident-leader",
    "generatedImages": ["url1", "url2", "url3", "url4"],
    "status": "completed",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:15.000Z"
  },
  {
    "id": "223e4567-e89b-12d3-a456-426614174001",
    "userId": "user-uuid",
    "originalImageUrl": "https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image2.jpg",
    "style": "modern",
    "personaType": "approachable-expert",
    "generatedImages": [],
    "status": "processing",
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:05.000Z"
  }
]
\`\`\``,
  })
  @ApiResponse({
    status: 200,
    description: 'List of all headshot generations for the authenticated user',
    type: [HeadshotGeneration],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  async getUserGenerations(
    @Request() req,
  ): Promise<HeadshotGeneration[]> {
    return this.headshotGeneratorService.getUserGenerations(req.user.id);
  }
}

