import { ApiProperty } from '@nestjs/swagger';

export enum MetricEventType {
  MetricUpdate = 'metric_update',
  UserRegistered = 'user_registered',
  FeatureUsed = 'feature_used',
  Heartbeat = 'heartbeat',
}

export class MetricEventDto {
  @ApiProperty({
    description: 'Event type',
    enum: MetricEventType,
    example: MetricEventType.MetricUpdate,
  })
  type: MetricEventType;

  @ApiProperty({
    description: 'Event timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Event data (varies by type)',
    example: { metric: 'user_count', value: 150 },
  })
  data: any;
}






