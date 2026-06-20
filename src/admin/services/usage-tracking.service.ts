import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UsageTracking } from '../entities/usage-tracking.entity';

@Injectable()
export class UsageTrackingService {
  constructor(
    @InjectRepository(UsageTracking)
    private usageTrackingRepository: Repository<UsageTracking>,
  ) {}

  async trackAction(
    userId: string,
    actionType: string,
    module: string,
    metadata?: any,
  ): Promise<UsageTracking> {
    const tracking = this.usageTrackingRepository.create({
      userId,
      actionType,
      module,
      metadata,
    });
    return this.usageTrackingRepository.save(tracking);
  }

  async trackUsageWithCosts(
    userId: string,
    actionType: string,
    module: string,
    tokensUsed: number,
    costUsd: number,
    costNgn: number,
    metadata?: any,
    creditsConsumed = 0,
  ): Promise<UsageTracking> {
    const tracking = this.usageTrackingRepository.create({
      userId,
      actionType,
      module,
      tokensUsed,
      costUsd,
      costNgn,
      creditsConsumed,
      metadata,
    });
    return this.usageTrackingRepository.save(tracking);
  }

  async getUserUsage(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UsageTracking[]> {
    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt = Between(startDate, endDate || new Date());
      } else if (endDate) {
        where.createdAt = Between(new Date(0), endDate);
      }
    }
    return this.usageTrackingRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getModuleUsage(
    module: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UsageTracking[]> {
    const where: any = { module };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate && endDate) {
        where.createdAt = Between(startDate, endDate);
      } else if (startDate) {
        where.createdAt = Between(startDate, new Date());
      } else if (endDate) {
        where.createdAt = Between(new Date(0), endDate);
      }
    }
    return this.usageTrackingRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getAggregatedStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalActions: number;
    actionsByModule: Record<string, number>;
    actionsByType: Record<string, number>;
    uniqueUsers: number;
  }> {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate && endDate) {
        where.createdAt = Between(startDate, endDate);
      } else if (startDate) {
        where.createdAt = Between(startDate, new Date());
      } else if (endDate) {
        where.createdAt = Between(new Date(0), endDate);
      }
    }

    const allTracking = await this.usageTrackingRepository.find({ where });

    const actionsByModule: Record<string, number> = {};
    const actionsByType: Record<string, number> = {};
    const uniqueUserIds = new Set<string>();

    allTracking.forEach((tracking) => {
      uniqueUserIds.add(tracking.userId);
      actionsByModule[tracking.module] =
        (actionsByModule[tracking.module] || 0) + 1;
      actionsByType[tracking.actionType] =
        (actionsByType[tracking.actionType] || 0) + 1;
    });

    return {
      totalActions: allTracking.length,
      actionsByModule,
      actionsByType,
      uniqueUsers: uniqueUserIds.size,
    };
  }

  /**
   * Get daily usage stats for a specific user
   * Returns breakdown by day with tokens and costs
   */
  async getUserDailyStats(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    dailyStats: Array<{
      date: string;
      tokensUsed: number;
      costUsd: number;
      costNgn: number;
      actionsCount: number;
    }>;
    totals: {
      tokensUsed: number;
      costUsd: number;
      costNgn: number;
      actionsCount: number;
    };
  }> {
    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate && endDate) {
        where.createdAt = Between(startDate, endDate);
      } else if (startDate) {
        where.createdAt = Between(startDate, new Date());
      } else if (endDate) {
        where.createdAt = Between(new Date(0), endDate);
      }
    }

    const allTracking = await this.usageTrackingRepository.find({
      where,
      order: { createdAt: 'ASC' },
    });

    // Group by date
    const dailyMap = new Map<
      string,
      {
        tokensUsed: number;
        costUsd: number;
        costNgn: number;
        actionsCount: number;
      }
    >();

    allTracking.forEach((tracking) => {
      const date = tracking.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
      const existing = dailyMap.get(date) || {
        tokensUsed: 0,
        costUsd: 0,
        costNgn: 0,
        actionsCount: 0,
      };

      existing.tokensUsed += tracking.tokensUsed || 0;
      existing.costUsd += Number(tracking.costUsd) || 0;
      existing.costNgn += Number(tracking.costNgn) || 0;
      existing.actionsCount += 1;

      dailyMap.set(date, existing);
    });

    // Convert to array and calculate totals
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        tokensUsed: stats.tokensUsed,
        costUsd: Math.round(stats.costUsd * 1_000_000) / 1_000_000,
        costNgn: Math.round(stats.costNgn * 100) / 100,
        actionsCount: stats.actionsCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totals = dailyStats.reduce(
      (acc, day) => ({
        tokensUsed: acc.tokensUsed + day.tokensUsed,
        costUsd: acc.costUsd + day.costUsd,
        costNgn: acc.costNgn + day.costNgn,
        actionsCount: acc.actionsCount + day.actionsCount,
      }),
      { tokensUsed: 0, costUsd: 0, costNgn: 0, actionsCount: 0 },
    );

    return {
      dailyStats,
      totals: {
        tokensUsed: totals.tokensUsed,
        costUsd: Math.round(totals.costUsd * 1_000_000) / 1_000_000,
        costNgn: Math.round(totals.costNgn * 100) / 100,
        actionsCount: totals.actionsCount,
      },
    };
  }
}
