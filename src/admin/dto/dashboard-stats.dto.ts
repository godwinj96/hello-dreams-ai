import { ApiProperty } from '@nestjs/swagger';
import { UsageMetricsDto } from './usage-metrics.dto';

export class UserMetricsDto {
  @ApiProperty({ description: 'Total number of users', example: 1000 })
  totalUsers: number;

  @ApiProperty({ description: 'Number of active users', example: 950 })
  activeUsers: number;

  @ApiProperty({ description: 'Number of inactive users', example: 50 })
  inactiveUsers: number;

  @ApiProperty({
    description: 'New registrations in the last 24 hours',
    example: 10,
  })
  newUsersLast24h: number;

  @ApiProperty({
    description: 'New registrations in the last 7 days',
    example: 50,
  })
  newUsersLast7d: number;

  @ApiProperty({
    description: 'New registrations in the last 30 days',
    example: 200,
  })
  newUsersLast30d: number;

  @ApiProperty({
    description: 'Users by role',
    example: { user: 900, admin: 90, superuser: 10 },
  })
  usersByRole: Record<string, number>;
}

export class FeatureUsageDto {
  @ApiProperty({ description: 'Resume builder usage count', example: 500 })
  resumeBuilder: number;

  @ApiProperty({ description: 'Career profile usage count', example: 300 })
  careerProfile: number;

  @ApiProperty({ description: 'Document generator usage count', example: 400 })
  documentGenerator: number;

  @ApiProperty({ description: 'Persona builder usage count', example: 200 })
  personaBuilder: number;

  @ApiProperty({
    description: 'LinkedIn optimization usage count',
    example: 50,
  })
  linkedinOptimization: number;

  @ApiProperty({ description: 'Headshot generator usage count', example: 50 })
  headshotGenerator: number;
}

export class ActivityMetricsDto {
  @ApiProperty({ description: 'Daily active users', example: 150 })
  dau: number;

  @ApiProperty({ description: 'Weekly active users', example: 500 })
  wau: number;

  @ApiProperty({ description: 'Monthly active users', example: 900 })
  mau: number;
}

export class DashboardStatsDto {
  @ApiProperty({ description: 'User metrics', type: UserMetricsDto })
  userMetrics: UserMetricsDto;

  @ApiProperty({ description: 'Feature usage metrics', type: FeatureUsageDto })
  featureUsage: FeatureUsageDto;

  @ApiProperty({ description: 'Usage metrics', type: UsageMetricsDto })
  usageMetrics: UsageMetricsDto;

  @ApiProperty({ description: 'Activity metrics', type: ActivityMetricsDto })
  activityMetrics: ActivityMetricsDto;

  @ApiProperty({
    description: 'Timestamp of when stats were generated',
    example: '2024-01-01T00:00:00.000Z',
  })
  generatedAt: Date;
}






