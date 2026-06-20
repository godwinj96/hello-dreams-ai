import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UsageTracking } from '../entities/usage-tracking.entity';
import { User } from '../../users/entities/user.entity';
import { TimeRangeDto, TimeRange } from '../dto/time-range.dto';
import {
  CostSummaryDto,
  CostTrendDto,
  UsageLedgerRowDto,
} from '../dto/costs.dto';
import { readRawNumber } from '../../shared/utils/raw-query.util';

@Injectable()
export class CostsService {
  constructor(
    @InjectRepository(UsageTracking)
    private usageTrackingRepository: Repository<UsageTracking>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  private getDateRange(timeRange?: TimeRangeDto): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = timeRange?.endDate
      ? new Date(timeRange.endDate)
      : new Date();
    let startDate: Date;

    if (timeRange?.startDate) {
      startDate = new Date(timeRange.startDate);
    } else {
      const now = new Date();
      switch (timeRange?.timeRange ?? TimeRange.Month) {
        case TimeRange.Today:
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case TimeRange.Week:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.Year:
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.Month:
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }

  async getSummary(timeRange?: TimeRangeDto): Promise<CostSummaryDto> {
    const { startDate, endDate } = this.getDateRange(timeRange);

    const totals = await this.usageTrackingRepository
      .createQueryBuilder('usage')
      .select('COALESCE(SUM(usage.tokensUsed), 0)', 'totalTokensUsed')
      .addSelect('COALESCE(SUM(usage.costUsd), 0)', 'totalCostUsd')
      .addSelect('COALESCE(SUM(usage.costNgn), 0)', 'totalCostNgn')
      .addSelect('COUNT(*)', 'trackedCallCount')
      .addSelect(
        `SUM(CASE WHEN usage.metadata->>'estimated' = 'true' THEN 1 ELSE 0 END)`,
        'estimatedCallCount',
      )
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('(usage.costUsd > 0 OR usage.tokensUsed > 0)')
      .getRawOne();

    const moduleRows = await this.usageTrackingRepository
      .createQueryBuilder('usage')
      .select('usage.module', 'module')
      .addSelect('COALESCE(SUM(usage.costUsd), 0)', 'costUsd')
      .addSelect('COALESCE(SUM(usage.costNgn), 0)', 'costNgn')
      .addSelect('COUNT(*)', 'callCount')
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('usage.costUsd > 0')
      .groupBy('usage.module')
      .getRawMany();

    const operationRows = await this.usageTrackingRepository
      .createQueryBuilder('usage')
      .select("COALESCE(usage.metadata->>'operation', 'unknown')", 'operation')
      .addSelect('COALESCE(SUM(usage.costUsd), 0)', 'costUsd')
      .addSelect('COALESCE(SUM(usage.tokensUsed), 0)', 'tokensUsed')
      .addSelect('COUNT(*)', 'callCount')
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('usage.costUsd > 0')
      .groupBy("usage.metadata->>'operation'")
      .getRawMany();

    const actionRows = await this.usageTrackingRepository
      .createQueryBuilder('usage')
      .select('usage.actionType', 'actionType')
      .addSelect('COALESCE(SUM(usage.costUsd), 0)', 'costUsd')
      .addSelect('COUNT(*)', 'callCount')
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('usage.costUsd > 0')
      .groupBy('usage.actionType')
      .getRawMany();

    const topUserRows = await this.usageTrackingRepository
      .createQueryBuilder('usage')
      .leftJoin(User, 'user', 'user.id = usage.userId')
      .select('usage.userId', 'userId')
      .addSelect('user.email', 'email')
      .addSelect('COALESCE(SUM(usage.costUsd), 0)', 'costUsd')
      .addSelect('COUNT(*)', 'callCount')
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('usage.costUsd > 0')
      .groupBy('usage.userId')
      .addGroupBy('user.email')
      .orderBy('costUsd', 'DESC')
      .limit(10)
      .getRawMany();

    const toBreakdown = (rows: any[], includeTokens = false) =>
      rows.reduce(
        (acc, row) => {
          const key = row.module ?? row.operation ?? row.actionType;
          acc[key] = {
            costUsd: readRawNumber(row, 'costUsd'),
            costNgn: readRawNumber(row, 'costNgn'),
            callCount: readRawNumber(row, 'callCount'),
            ...(includeTokens
              ? { tokensUsed: readRawNumber(row, 'tokensUsed') }
              : {}),
          };
          return acc;
        },
        {} as Record<string, any>,
      );

    return {
      totalTokensUsed: readRawNumber(totals, 'totalTokensUsed'),
      totalCostUsd: readRawNumber(totals, 'totalCostUsd'),
      totalCostNgn: readRawNumber(totals, 'totalCostNgn'),
      trackedCallCount: readRawNumber(totals, 'trackedCallCount'),
      estimatedCallCount: readRawNumber(totals, 'estimatedCallCount'),
      costByModule: toBreakdown(moduleRows),
      costByOperation: toBreakdown(operationRows, true),
      costByActionType: toBreakdown(actionRows),
      topUsers: topUserRows.map((row) => ({
        userId: row.userId,
        email: row.email ?? undefined,
        costUsd: readRawNumber(row, 'costUsd'),
        callCount: readRawNumber(row, 'callCount'),
      })),
    };
  }

  async getTrend(timeRange?: TimeRangeDto): Promise<CostTrendDto> {
    const { startDate, endDate } = this.getDateRange(timeRange);

    const rows = await this.usageTrackingRepository
      .createQueryBuilder('usage')
      .select("TO_CHAR(usage.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COALESCE(SUM(usage.costUsd), 0)', 'costUsd')
      .addSelect('COALESCE(SUM(usage.costNgn), 0)', 'costNgn')
      .addSelect('COALESCE(SUM(usage.tokensUsed), 0)', 'tokensUsed')
      .addSelect('COUNT(*)', 'callCount')
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('(usage.costUsd > 0 OR usage.tokensUsed > 0)')
      .groupBy("TO_CHAR(usage.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      dailyTrend: rows.map((row) => ({
        date: row.date,
        costUsd: readRawNumber(row, 'costUsd'),
        costNgn: readRawNumber(row, 'costNgn'),
        tokensUsed: readRawNumber(row, 'tokensUsed'),
        callCount: readRawNumber(row, 'callCount'),
      })),
    };
  }

  async getLedger(params: {
    timeRange?: TimeRangeDto;
    page?: number;
    limit?: number;
    module?: string;
    operation?: string;
    actionType?: string;
    userId?: string;
  }): Promise<{
    data: UsageLedgerRowDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { startDate, endDate } = this.getDateRange(params.timeRange);
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const qb = this.usageTrackingRepository
      .createQueryBuilder('usage')
      .leftJoinAndSelect('usage.user', 'user')
      .where('usage.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('(usage.costUsd > 0 OR usage.tokensUsed > 0)');

    if (params.module)
      qb.andWhere('usage.module = :module', { module: params.module });
    if (params.actionType)
      qb.andWhere('usage.actionType = :actionType', {
        actionType: params.actionType,
      });
    if (params.userId)
      qb.andWhere('usage.userId = :userId', { userId: params.userId });
    if (params.operation) {
      qb.andWhere("usage.metadata->>'operation' = :operation", {
        operation: params.operation,
      });
    }

    const [rows, total] = await qb
      .orderBy('usage.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows.map((row) => this.mapLedgerRow(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportCsv(params: {
    timeRange?: TimeRangeDto;
    module?: string;
    operation?: string;
    actionType?: string;
    userId?: string;
  }): Promise<string> {
    const { data } = await this.getLedger({
      ...params,
      page: 1,
      limit: 10_000,
    });
    const header = [
      'id',
      'createdAt',
      'userId',
      'userEmail',
      'module',
      'actionType',
      'tokensUsed',
      'costUsd',
      'costNgn',
      'operation',
      'model',
      'provider',
      'estimated',
    ].join(',');

    const lines = data.map((row) =>
      [
        row.id,
        row.createdAt.toISOString(),
        row.userId,
        row.userEmail ?? '',
        row.module,
        row.actionType,
        row.tokensUsed,
        row.costUsd,
        row.costNgn,
        row.operation ?? '',
        row.model ?? '',
        row.provider ?? '',
        row.estimated ? 'true' : 'false',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    return [header, ...lines].join('\n');
  }

  private mapLedgerRow(row: UsageTracking): UsageLedgerRowDto {
    const metadata = row.metadata ?? {};
    return {
      id: row.id,
      createdAt: row.createdAt,
      userId: row.userId,
      userEmail: row.user?.email,
      module: row.module,
      actionType: row.actionType,
      tokensUsed: row.tokensUsed ?? 0,
      costUsd: Number(row.costUsd) || 0,
      costNgn: Number(row.costNgn) || 0,
      operation: metadata.operation as string | undefined,
      model: metadata.model as string | undefined,
      provider: metadata.provider as string | undefined,
      estimated: metadata.estimated as boolean | undefined,
    };
  }
}
