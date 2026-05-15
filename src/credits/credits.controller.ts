import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreditsService, CreditStatus } from './credits.service';

@ApiTags('credits')
@ApiBearerAuth('JWT-auth')
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('credits')
  @ApiOperation({ summary: 'Get daily credit status for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Credit status',
    schema: {
      type: 'object',
      properties: {
        used: { type: 'number', example: 3 },
        limit: { type: 'number', example: 5 },
        remaining: { type: 'number', example: 2, description: '-1 means unlimited (admin/superuser)' },
        resetsAt: { type: 'string', format: 'date-time' },
        exempt: { type: 'boolean' },
      },
    },
  })
  async getCredits(@Request() req): Promise<CreditStatus> {
    return this.creditsService.getCreditStatus(req.user);
  }
}
