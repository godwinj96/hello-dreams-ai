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
  @ApiOperation({ summary: 'Generate LinkedIn profile from resume data' })
  @ApiResponse({ status: 201, description: 'LinkedIn profile generated successfully', type: LinkedInProfile })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateProfile(@Request() req): Promise<LinkedInProfile> {
    return this.linkedInOptimizationService.generateProfile(req.user.id);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get generated LinkedIn profile' })
  @ApiResponse({ status: 200, description: 'LinkedIn profile', type: LinkedInProfile })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req): Promise<LinkedInProfile | null> {
    return this.linkedInOptimizationService.getProfile(req.user.id);
  }

  @Put('profile/:section')
  @ApiOperation({ summary: 'Update specific LinkedIn profile section' })
  @ApiParam({ name: 'section', description: 'Section to update (headline, about, experience, etc.)' })
  @ApiResponse({ status: 200, description: 'Section updated successfully', type: LinkedInProfile })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Replace entire LinkedIn profile JSON' })
  @ApiResponse({ status: 200, description: 'Profile replaced', type: LinkedInProfile })
  async replaceProfile(
    @Request() req,
    @Body() body: Partial<LinkedInProfile>,
  ): Promise<LinkedInProfile> {
    return this.linkedInOptimizationService.replaceProfile(req.user.id, body);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Partially update LinkedIn profile JSON' })
  @ApiResponse({ status: 200, description: 'Profile patched', type: LinkedInProfile })
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
  async deleteProfile(
    @Request() req,
  ): Promise<void> {
    return this.linkedInOptimizationService.deleteProfile(req.user.id);
  }
}








