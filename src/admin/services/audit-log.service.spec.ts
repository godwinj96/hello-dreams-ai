import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AuditAction } from '../enums/audit-action.enum';

describe('AuditLogService', () => {
  let service: AuditLogService;
  const mockRepo = {
    create: jest.fn((data) => data),
    save: jest.fn((data) => Promise.resolve({ id: 'log-1', ...data })),
    createQueryBuilder: jest.fn(() => ({
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
        AuditLogService,
        { provide: getRepositoryToken(AdminAuditLog), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(AuditLogService);
    jest.clearAllMocks();
  });

  it('should log an audit entry', async () => {
    const entry = {
      actorId: 'actor-1',
      actorEmail: 'admin@test.com',
      action: AuditAction.UserActivated,
      targetType: 'user',
      targetId: 'user-1',
    };

    const result = await service.log(entry);
    expect(mockRepo.create).toHaveBeenCalledWith(entry);
    expect(mockRepo.save).toHaveBeenCalled();
    expect(result.action).toBe(AuditAction.UserActivated);
  });

  it('should return paginated audit log', async () => {
    const result = await service.findAll({ page: 1, limit: 20 });
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
    expect(result.data).toEqual([]);
  });
});
