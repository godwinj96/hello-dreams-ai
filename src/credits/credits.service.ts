import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { UsageTracking } from '../admin/entities/usage-tracking.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';

export interface CreditStatus {
  used: number;
  limit: number;
  remaining: number; // -1 means unlimited (exempt)
  resetsAt: string;  // ISO 8601
  exempt: boolean;
}

const DAILY_LIMIT = 5;

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(UsageTracking)
    private usageTrackingRepository: Repository<UsageTracking>,
  ) {}

  async getCreditStatus(user: User): Promise<CreditStatus> {
    const exempt =
      user.role === Role.Admin || user.role === Role.Superuser;

    const todayMidnightUtc = new Date();
    todayMidnightUtc.setUTCHours(0, 0, 0, 0);

    const tomorrowMidnightUtc = new Date(todayMidnightUtc);
    tomorrowMidnightUtc.setUTCDate(tomorrowMidnightUtc.getUTCDate() + 1);

    const used = await this.usageTrackingRepository.count({
      where: {
        userId: user.id,
        actionType: 'message_sent',
        createdAt: MoreThanOrEqual(todayMidnightUtc),
      },
    });

    return {
      used,
      limit: DAILY_LIMIT,
      remaining: exempt ? -1 : Math.max(0, DAILY_LIMIT - used),
      resetsAt: tomorrowMidnightUtc.toISOString(),
      exempt,
    };
  }
}
