import { ApiProperty } from '@nestjs/swagger';

export class DailyStatDto {
  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ description: 'Total tokens used on this day' })
  tokensUsed: number;

  @ApiProperty({ description: 'Total cost in USD on this day' })
  costUsd: number;

  @ApiProperty({ description: 'Total cost in NGN on this day' })
  costNgn: number;

  @ApiProperty({ description: 'Number of actions on this day' })
  actionsCount: number;
}

export class UserDailyStatsDto {
  @ApiProperty({
    type: [DailyStatDto],
    description: 'Daily breakdown of usage stats',
  })
  dailyStats: DailyStatDto[];

  @ApiProperty({ description: 'Total aggregated stats' })
  totals: {
    tokensUsed: number;
    costUsd: number;
    costNgn: number;
    actionsCount: number;
  };
}
