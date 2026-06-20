import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum TimeRange {
  Today = 'today',
  Week = 'week',
  Month = 'month',
  Year = 'year',
  Custom = 'custom',
}

export class TimeRangeDto {
  @ApiProperty({
    description: 'Time range for statistics',
    enum: TimeRange,
    example: TimeRange.Week,
    required: false,
  })
  @IsOptional()
  @IsEnum(TimeRange)
  timeRange?: TimeRange = TimeRange.Week;

  @ApiProperty({
    description: 'Start date for custom time range (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for custom time range (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
