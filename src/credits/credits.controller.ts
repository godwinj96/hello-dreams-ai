import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreditsService, CreditStatus } from './credits.service';

@ApiTags('credits')
@ApiBearerAuth('JWT-auth')
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get()
  @ApiOperation({ summary: 'Get daily credit status for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Token-based credit status',
    schema: {
      type: 'object',
      properties: {
        plan: { type: 'string', enum: ['free', 'pro'], example: 'free' },
        subscription: {
          type: 'object',
          nullable: true,
          properties: {
            status: { type: 'string', example: 'active' },
            billingCycle: {
              type: 'string',
              enum: ['monthly', 'annual'],
              example: 'monthly',
            },
            nextBillingDate: { type: 'string', format: 'date-time' },
          },
        },
        daily: {
          type: 'object',
          properties: {
            usedCredits: { type: 'number', example: 3.5 },
            limitCredits: { type: 'number', example: 5 },
            remainingCredits: {
              type: 'number',
              example: 1.5,
              description: '-1 means unlimited (admin/superuser)',
            },
            usedTokens: { type: 'number', example: 2800 },
            limitTokens: { type: 'number', example: 4000 },
            resetsAt: { type: 'string', format: 'date-time' },
          },
        },
        balanceCredits: {
          type: 'number',
          example: 0,
          description: 'Prepaid credit balance (overflow after daily cap)',
        },
        tokensPerCredit: { type: 'number', example: 800 },
        exempt: { type: 'boolean' },
      },
    },
  })
  async getCredits(@Request() req): Promise<CreditStatus> {
    return this.creditsService.getCreditStatus(req.user);
  }

  /** @deprecated Use GET /credits — kept for backward compatibility */
  @Get('credits')
  async getCreditsLegacy(@Request() req): Promise<CreditStatus> {
    return this.creditsService.getCreditStatus(req.user);
  }
}
