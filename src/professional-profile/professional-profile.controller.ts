import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfessionalProfileService } from './professional-profile.service';
import { ProfessionalProfile } from './entities/professional-profile.entity';

@ApiTags('professional-profile')
@ApiBearerAuth('JWT-auth')
@Controller('professional-profile')
@UseGuards(JwtAuthGuard)
export class ProfessionalProfileController {
  constructor(private readonly profileService: ProfessionalProfileService) {}

  @Get('me')
  @ApiOperation({
    summary: "Get the current user's professional profile",
    description:
      'Returns the full ProfessionalProfile record for the authenticated user, including basicInfo, cvMetadata, extractedData, persona, and completedSections. Creates an empty profile if one does not yet exist.',
  })
  @ApiResponse({ status: 200, description: 'Profile returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyProfile(@Request() req): Promise<ProfessionalProfile> {
    return this.profileService.getProfile(req.user.id);
  }
}
