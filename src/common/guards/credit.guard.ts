import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../../credits/credits.service';

@Injectable()
export class CreditGuard implements CanActivate {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    const status = await this.creditsService.getCreditStatus(user);
    const minCredits = this.configService.get<number>('MIN_CREDITS_PER_OP', 1);

    if (status.exempt) return true;

    if (status.daily.remainingCredits >= minCredits) return true;

    if (status.balanceCredits >= minCredits) return true;

    throw new HttpException(
      {
        code: 'CREDIT_LIMIT_REACHED',
        usedCredits: status.daily.usedCredits,
        limitCredits: status.daily.limitCredits,
        usedTokens: status.daily.usedTokens,
        balanceCredits: status.balanceCredits,
        tokensPerCredit: status.tokensPerCredit,
        resetsAt: status.daily.resetsAt,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
