import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminPaymentsService } from './admin-payments.service';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Subscription, SubscriptionStatus, BillingCycle } from '../../payments/entities/subscription.entity';
import { User } from '../../users/entities/user.entity';

describe('AdminPaymentsService', () => {
  let service: AdminPaymentsService;

  const mockPaymentRepo = {
    find: jest.fn().mockResolvedValue([
      { amount: 1000, status: PaymentStatus.Success, createdAt: new Date() },
      { amount: 500, status: PaymentStatus.Failed, createdAt: new Date() },
    ]),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
  };

  const mockSubRepo = {
    count: jest.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1),
    find: jest.fn().mockResolvedValue([
      { billingCycle: BillingCycle.Monthly, status: SubscriptionStatus.Active },
    ]),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminPaymentsService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Subscription), useValue: mockSubRepo },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    service = module.get(AdminPaymentsService);
    jest.clearAllMocks();
  });

  it('should calculate payment stats', async () => {
    mockPaymentRepo.find.mockResolvedValue([
      { amount: 1000, status: PaymentStatus.Success, createdAt: new Date('2024-06-01') },
      { amount: 500, status: PaymentStatus.Failed, createdAt: new Date('2024-06-02') },
    ]);
    mockSubRepo.count.mockResolvedValue(2);
    mockSubRepo.find.mockResolvedValue([
      { billingCycle: BillingCycle.Monthly, status: SubscriptionStatus.Active },
    ]);

    const stats = await service.getPaymentStats({ timeRange: 'week' as any });
    expect(stats.totalRevenue).toBe(1000);
    expect(stats.successfulPayments).toBe(1);
    expect(stats.failedPayments).toBe(1);
    expect(stats.successRate).toBe(50);
  });
});
