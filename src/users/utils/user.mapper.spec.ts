import { toUserResponseDto } from './user.mapper';
import { User } from '../entities/user.entity';
import { Role } from '../enums/role.enum';

describe('toUserResponseDto', () => {
  const mockUser = {
    id: 'uuid-1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-secret',
    googleId: 'google-123',
    role: Role.User,
    isActive: true,
    avatar_url: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  } as User;

  it('should strip password and googleId from response', () => {
    const dto = toUserResponseDto(mockUser);
    expect(dto).not.toHaveProperty('password');
    expect(dto).not.toHaveProperty('googleId');
    expect(dto.email).toBe('test@example.com');
    expect(dto.role).toBe(Role.User);
  });
});
