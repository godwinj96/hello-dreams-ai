import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UsageTracking } from '../entities/usage-tracking.entity';
import {
  DashboardStatsDto,
  UserMetricsDto,
  FeatureUsageDto,
  ActivityMetricsDto,
  CostMetricsDto,
  RegistrationTrendPointDto,
} from '../dto/dashboard-stats.dto';
import { TimeRangeDto, TimeRange } from '../dto/time-range.dto';
import { UsageMetricsDto } from '../dto/usage-metrics.dto';
import { UsageTrackingService } from './usage-tracking.service';
import { readRawNumber } from '../../shared/utils/raw-query.util';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UsageTracking)
    private usageTrackingRepository: Repository<UsageTracking>,
    private usageTrackingService: UsageTrackingService,
  ) {}

  private getDateRange(timeRange: TimeRangeDto): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = timeRange.endDate
      ? new Date(timeRange.endDate)
      : new Date();
    let startDate: Date;

    if (timeRange.startDate) {
      startDate = new Date(timeRange.startDate);
    } else {
      const now = new Date();
      switch (timeRange.timeRange) {
        case TimeRange.Today:
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case TimeRange.Week:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.Month:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.Year:
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }

  async getDashboardStats(
    userId: string,
    timeRange?: TimeRangeDto,
  ): Promise<DashboardStatsDto> {
    const range = timeRange || { timeRange: TimeRange.Week };
    const { startDate, endDate } = this.getDateRange(range);

    const [
      userMetrics,
      featureUsage,
      usageMetrics,
      activityMetrics,
      costMetrics,
      registrationTrend,
    ] = await Promise.all([
      this.getUserMetrics(),
      this.getFeatureUsage(startDate, endDate),
      this.usageTrackingService.getAggregatedStats(startDate, endDate),
      this.getActivityMetrics(),
      this.getCostMetrics(startDate, endDate),
      this.getRegistrationTrend(startDate, endDate),
    ]);

    return {
      userMetrics,
      featureUsage,
      usageMetrics: usageMetrics as UsageMetricsDto,
      activityMetrics,
      costMetrics,
      registrationTrend,
      generatedAt: new Date(),
    };
  }

  private async getUserMetrics(): Promise<UserMetricsDto> {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      allUsers,
      newUsersLast24h,
      newUsersLast7d,
      newUsersLast30d,
    ] = await Promise.all([
      this.usersRepository.count(),
      this.usersRepository.count({ where: { isActive: true } }),
      this.usersRepository.count({ where: { isActive: false } }),
      this.usersRepository.find({ select: ['role'] }),
      this.usersRepository
        .createQueryBuilder('user')
        .where('user.createdAt >= :date', {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .getCount(),
      this.usersRepository
        .createQueryBuilder('user')
        .where('user.createdAt >= :date', {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        })
        .getCount(),
      this.usersRepository
        .createQueryBuilder('user')
        .where('user.createdAt >= :date', {
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        })
        .getCount(),
    ]);

    const usersByRole = allUsers.reduce(
      (acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      newUsersLast24h,
      newUsersLast7d,
      newUsersLast30d,
      usersByRole,
    };
  }

  private async getFeatureUsage(
    startDate: Date,
    endDate: Date,
  ): Promise<FeatureUsageDto> {
    const modules = [
      'resume-builder',
      'career-profile',
      'document-generator',
      'persona-builder',
      'linkedin-optimization',
      'headshot-generator',
      'job-application',
    ];

    const usage = await Promise.all(
      modules.map((module) =>
        this.usageTrackingRepository.count({
          where: {
            module,
            createdAt: Between(startDate, endDate),
          },
        }),
      ),
    );

    return {
      resumeBuilder: usage[0],
      careerProfile: usage[1],
      documentGenerator: usage[2],
      personaBuilder: usage[3],
      linkedinOptimization: usage[4],
      headshotGenerator: usage[5],
      jobApplication: usage[6],
    };
  }

  private async getCostMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<CostMetricsDto> {
    const result = await this.usageTrackingRepository
      .createQueryBuilder('usage')
      .select('COALESCE(SUM(usage.tokensUsed), 0)', 'totalTokensUsed')
      .addSelect('COALESCE(SUM(usage.costUsd), 0)', 'totalCostUsd')
      .addSelect('COALESCE(SUM(usage.costNgn), 0)', 'totalCostNgn')
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    const totalTokensUsed = readRawNumber(result, 'totalTokensUsed');
    const totalCostUsd = readRawNumber(result, 'totalCostUsd');
    const totalCostNgn = readRawNumber(result, 'totalCostNgn');

    const moduleRows = await this.usageTrackingRepository
      .createQueryBuilder('usage')
      .select('usage.module', 'module')
      .addSelect('COALESCE(SUM(usage.costUsd), 0)', 'costUsd')
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('usage.costUsd > 0')
      .groupBy('usage.module')
      .getRawMany();

    const moduleMap = moduleRows.reduce(
      (acc, row) => {
        acc[row.module] = readRawNumber(row, 'costUsd');
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalTokensUsed,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      totalCostNgn: Math.round(totalCostNgn * 100) / 100,
      costByModule: {
        resumeBuilder: moduleMap['resume-builder'] ?? 0,
        careerProfile: moduleMap['career-profile'] ?? 0,
        documentGenerator: moduleMap['document-generator'] ?? 0,
        personaBuilder: moduleMap['persona-builder'] ?? 0,
        linkedinOptimization: moduleMap['linkedin-optimization'] ?? 0,
        headshotGenerator: moduleMap['headshot-generator'] ?? 0,
        jobApplication: moduleMap['job-application'] ?? 0,
        shared: moduleMap['shared'] ?? 0,
      },
    };
  }

  private async getRegistrationTrend(
    startDate: Date,
    endDate: Date,
  ): Promise<RegistrationTrendPointDto[]> {
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .select("TO_CHAR(user.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy("TO_CHAR(user.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  private async getActivityMetrics(): Promise<ActivityMetricsDto> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dau, wau, mau] = await Promise.all([
      this.usageTrackingRepository
        .createQueryBuilder('usage')
        .select('DISTINCT usage.userId', 'userId')
        .where('usage.createdAt >= :date', { date: dayAgo })
        .getRawMany()
        .then((result) => result.length),
      this.usageTrackingRepository
        .createQueryBuilder('usage')
        .select('DISTINCT usage.userId', 'userId')
        .where('usage.createdAt >= :date', { date: weekAgo })
        .getRawMany()
        .then((result) => result.length),
      this.usageTrackingRepository
        .createQueryBuilder('usage')
        .select('DISTINCT usage.userId', 'userId')
        .where('usage.createdAt >= :date', { date: monthAgo })
        .getRawMany()
        .then((result) => result.length),
    ]);

    return { dau, wau, mau };
  }

  async getRealTimeMetrics(
    userId: string,
  ): Promise<Partial<DashboardStatsDto>> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activeUsers, newUsersToday, recentActions] = await Promise.all([
      this.usersRepository.count({ where: { isActive: true } }),
      this.usersRepository
        .createQueryBuilder('user')
        .where('user.createdAt >= :date', { date: dayAgo })
        .getCount(),
      this.usageTrackingRepository.count({
        where: { createdAt: Between(dayAgo, now) },
      }),
    ]);

    return {
      userMetrics: {
        totalUsers: 0,
        activeUsers,
        inactiveUsers: 0,
        newUsersLast24h: newUsersToday,
        newUsersLast7d: 0,
        newUsersLast30d: 0,
        usersByRole: {},
      },
      usageMetrics: {
        totalActions: recentActions,
        actionsByModule: {},
        actionsByType: {},
        uniqueUsers: 0,
      },
      generatedAt: new Date(),
    } as Partial<DashboardStatsDto>;
  }
}
