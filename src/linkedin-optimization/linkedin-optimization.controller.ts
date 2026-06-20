import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LinkedInOptimizationService } from './linkedin-optimization.service';
import { LinkedInProfile } from './entities/linkedin-profile.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreditGuard } from '../common/guards/credit.guard';
import { HttpCode, HttpStatus } from '@nestjs/common';

@ApiTags('linkedin-optimization')
@ApiBearerAuth('JWT-auth')
@Controller('linkedin-optimization')
@UseGuards(JwtAuthGuard)
export class LinkedInOptimizationController {
  constructor(
    private readonly linkedInOptimizationService: LinkedInOptimizationService,
  ) {}

  @Post('generate')
  @UseGuards(CreditGuard)
  @ApiOperation({
    summary: 'Generate LinkedIn profile from resume data',
    description: `**Generate LinkedIn Profile**

Automatically generates an optimized LinkedIn profile from your resume data. The system uses AI to create professional LinkedIn content including headline, about section, experience descriptions, and more.

**Prerequisites:**
- You should have a resume created in the Resume Builder module
- The system will use your latest resume data to generate the LinkedIn profile

**What Gets Generated:**
- Professional headline
- About/Summary section
- Experience descriptions (optimized for LinkedIn)
- Skills section
- Recommendations for profile optimization

**Example Response:**
\`\`\`json
{
  "id": "profile-uuid",
  "userId": "user-uuid",
  "headline": "Senior Software Engineer | Full-Stack Developer | AI Enthusiast",
  "about": "Experienced software engineer with 8+ years...",
  "experience": [...],
  "skills": [...],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
\`\`\``,
  })
  @ApiResponse({
    status: 201,
    description: 'LinkedIn profile generated successfully',
    type: LinkedInProfile,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - No resume data found or generation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async generateProfile(@Request() req): Promise<LinkedInProfile> {
    return this.linkedInOptimizationService.generateProfile(req.user.id);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get generated LinkedIn profile' })
  @ApiResponse({
    status: 200,
    description: 'LinkedIn profile',
    type: LinkedInProfile,
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req): Promise<LinkedInProfile | null> {
    return this.linkedInOptimizationService.getProfile(req.user.id);
  }

  @Put('profile/:section')
  @ApiOperation({
    summary: 'Update specific LinkedIn profile section',
    description: `**Update Profile Section**

Update a specific section of your LinkedIn profile. Common sections include:
- \`headline\`: Professional headline/tagline
- \`about\`: About/Summary section
- \`experience\`: Work experience entries
- \`education\`: Education entries
- \`skills\`: Skills list
- \`certifications\`: Certifications
- \`projects\`: Projects section

**Example Request:**
\`\`\`json
{
  "headline": "Senior Software Engineer | Full-Stack Developer | AI Enthusiast"
}
\`\`\`

**Example Request (Experience):**
\`\`\`json
{
  "experience": [
    {
      "title": "Senior Software Engineer",
      "company": "Tech Corp",
      "duration": "2021 - Present",
      "description": "Led development of..."
    }
  ]
}
\`\`\``,
  })
  @ApiParam({
    name: 'section',
    description:
      'Section name to update (e.g., headline, about, experience, education, skills, certifications, projects)',
    example: 'headline',
  })
  @ApiResponse({
    status: 200,
    description: 'Section updated successfully',
    type: LinkedInProfile,
  })
  @ApiResponse({
    status: 404,
    description:
      'Profile not found - Generate a profile first using POST /linkedin-optimization/generate',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async updateSection(
    @Param('section') section: string,
    @Request() req,
    @Body() data: any,
  ): Promise<LinkedInProfile> {
    return this.linkedInOptimizationService.updateSection(
      req.user.id,
      section as keyof LinkedInProfile,
      data,
    );
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Replace entire LinkedIn profile JSON',
    description: `**Replace Entire Profile**

Replace the entire LinkedIn profile with new data. This completely overwrites the existing profile.

**Use Case:** When you want to make multiple changes at once or completely rewrite your profile.

**Example Request Body:**
\`\`\`json
{
  "headline": "Senior Software Engineer | Full-Stack Developer",
  "about": "Experienced software engineer...",
  "experience": [...],
  "education": [...],
  "skills": [...]
}
\`\`\``,
  })
  @ApiResponse({
    status: 200,
    description: 'Profile replaced successfully',
    type: LinkedInProfile,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async replaceProfile(
    @Request() req,
    @Body() body: Partial<LinkedInProfile>,
  ): Promise<LinkedInProfile> {
    return this.linkedInOptimizationService.replaceProfile(req.user.id, body);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Partially update LinkedIn profile JSON',
    description: `**Partial Profile Update**

Partially update your LinkedIn profile. Only the fields you provide will be updated; other fields remain unchanged.

**Use Case:** When you want to update specific fields without affecting the rest of the profile.

**Example Request (Update only headline and about):**
\`\`\`json
{
  "headline": "Updated Professional Headline",
  "about": "Updated about section..."
}
\`\`\`

**Note:** This is different from PUT which replaces the entire profile. PATCH only updates the fields you specify.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Profile partially updated successfully',
    type: LinkedInProfile,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async patchProfile(
    @Request() req,
    @Body() body: Partial<LinkedInProfile>,
  ): Promise<LinkedInProfile> {
    return this.linkedInOptimizationService.patchProfile(req.user.id, body);
  }

  @Delete('profile')
  @ApiOperation({ summary: 'Delete LinkedIn profile' })
  @ApiResponse({ status: 204, description: 'Profile deleted' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProfile(@Request() req): Promise<void> {
    return this.linkedInOptimizationService.deleteProfile(req.user.id);
  }
}
