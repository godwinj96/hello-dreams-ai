import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.User,
  })
  role: Role;

  @ApiProperty({
    description: 'User active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar_url?: string;

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

export class UserStatsDto {
  @ApiProperty({
    description: 'Total number of users',
    example: 100,
  })
  totalUsers: number;

  @ApiProperty({
    description: 'Number of active users',
    example: 95,
  })
  activeUsers: number;

  @ApiProperty({
    description: 'Number of inactive users',
    example: 5,
  })
  inactiveUsers: number;

  @ApiProperty({
    description: 'Number of users by role',
    example: { user: 90, admin: 8, superuser: 2 },
  })
  usersByRole: Record<Role, number>;

  @ApiProperty({
    description: 'New registrations in the last 24 hours',
    example: 5,
  })
  newUsersLast24h: number;

  @ApiProperty({
    description: 'New registrations in the last 7 days',
    example: 20,
  })
  newUsersLast7d: number;

  @ApiProperty({
    description: 'New registrations in the last 30 days',
    example: 75,
  })
  newUsersLast30d: number;
}
