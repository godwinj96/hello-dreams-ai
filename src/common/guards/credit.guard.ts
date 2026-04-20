import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CreditsService } from '../../credits/credits.service';

@Injectable()
export class CreditGuard implements CanActivate {
  constructor(private readonly creditsService: CreditsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    const status = await this.creditsService.getCreditStatus(user);

    if (status.exempt || status.remaining > 0) return true;

    throw new HttpException(
      {
        code: 'CREDIT_LIMIT_REACHED',
        used: status.used,
        limit: status.limit,
        resetsAt: status.resetsAt,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
