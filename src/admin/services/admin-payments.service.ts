import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  Payment,
  PaymentStatus,
} from '../../payments/entities/payment.entity';
import {
  Subscription,
  SubscriptionStatus,
  BillingCycle,
} from '../../payments/entities/subscription.entity';
import { User } from '../../users/entities/user.entity';
import { TimeRange, TimeRangeDto } from '../dto/time-range.dto';
import {
  PaymentAdminFiltersDto,
  SubscriptionAdminFiltersDto,
} from '../dto/payment-admin-filters.dto';

export interface PaymentStatsDto {
  totalRevenue: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  successRate: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  mrrEstimate: number;
  revenueTrend: Array<{ date: string; amount: number }>;
}

@Injectable()
export class AdminPaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
      switch (timeRange?.timeRange) {
        case TimeRange.Today:
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case TimeRange.Month:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.Year:
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.Week:
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }

  async getPaymentStats(timeRange?: TimeRangeDto): Promise<PaymentStatsDto> {
    const { startDate, endDate } = this.getDateRange(timeRange);

    const paymentsInRange = await this.paymentRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

    const successful = paymentsInRange.filter(
      (p) => p.status === PaymentStatus.Success,
    );
    const failed = paymentsInRange.filter(
      (p) => p.status === PaymentStatus.Failed,
    );
    const pending = paymentsInRange.filter(
      (p) => p.status === PaymentStatus.Pending,
    );

    const totalRevenue = successful.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    const completedCount = successful.length + failed.length;
    const successRate =
      completedCount > 0 ? (successful.length / completedCount) * 100 : 0;

    const [activeSubscriptions, cancelledSubscriptions] = await Promise.all([
      this.subscriptionRepository.count({
        where: { status: SubscriptionStatus.Active },
      }),
      this.subscriptionRepository.count({
        where: { status: SubscriptionStatus.Cancelled },
      }),
    ]);

    const activeSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.Active },
    });

    const mrrEstimate = activeSubs.reduce((sum, sub) => {
      const monthlyAmount = this.estimateMonthlyAmount(sub);
      return sum + monthlyAmount;
    }, 0);

    const revenueByDay = new Map<string, number>();
    successful.forEach((p) => {
      const date = p.createdAt.toISOString().split('T')[0];
      revenueByDay.set(
        date,
        (revenueByDay.get(date) || 0) + Number(p.amount),
      );
    });

    const revenueTrend = Array.from(revenueByDay.entries())
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      successfulPayments: successful.length,
      failedPayments: failed.length,
      pendingPayments: pending.length,
      successRate: Math.round(successRate * 100) / 100,
      activeSubscriptions,
      cancelledSubscriptions,
      mrrEstimate: Math.round(mrrEstimate * 100) / 100,
      revenueTrend,
    };
  }

  private estimateMonthlyAmount(sub: Subscription): number {
    // Placeholder MRR estimate — plan amounts would come from config/plan table
    const baseMonthly = 5000;
    if (sub.billingCycle === BillingCycle.Annual) {
      return baseMonthly;
    }
    return baseMonthly;
  }

  async listPayments(filters: PaymentAdminFiltersDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .orderBy('payment.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters.status) {
      qb.andWhere('payment.status = :status', { status: filters.status });
    }

    if (filters.type) {
      qb.andWhere('payment.type = :type', { type: filters.type });
    }

    if (filters.search) {
      qb.andWhere('user.email ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    if (filters.startDate && filters.endDate) {
      qb.andWhere('payment.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate),
      });
    }

    const [payments, total] = await qb.getManyAndCount();

    return {
      data: payments.map((p) => ({
        id: p.id,
        userId: p.userId,
        userEmail: p.user?.email,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        type: p.type,
        paystackReference: p.paystackReference,
        createdAt: p.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listSubscriptions(filters: SubscriptionAdminFiltersDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.subscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.user', 'user')
      .orderBy('subscription.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters.status) {
      qb.andWhere('subscription.status = :status', { status: filters.status });
    }

    if (filters.search) {
      qb.andWhere('user.email ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    const [subscriptions, total] = await qb.getManyAndCount();

    return {
      data: subscriptions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userEmail: s.user?.email,
        planId: s.planId,
        status: s.status,
        billingCycle: s.billingCycle,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        createdAt: s.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
