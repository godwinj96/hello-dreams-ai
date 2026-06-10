import { ApiProperty } from '@nestjs/swagger';

export class CostBreakdownItemDto {
  @ApiProperty()
  costUsd: number;

  @ApiProperty()
  costNgn: number;

  @ApiProperty()
  callCount: number;

  @ApiProperty({ required: false })
  tokensUsed?: number;
}

export class CostTopUserDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty()
  costUsd: number;

  @ApiProperty()
  callCount: number;
}

export class CostSummaryDto {
  @ApiProperty()
  totalTokensUsed: number;

  @ApiProperty()
  totalCostUsd: number;

  @ApiProperty()
  totalCostNgn: number;

  @ApiProperty()
  trackedCallCount: number;

  @ApiProperty()
  estimatedCallCount: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'object' } })
  costByModule: Record<string, CostBreakdownItemDto>;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'object' } })
  costByOperation: Record<string, CostBreakdownItemDto>;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'object' } })
  costByActionType: Record<string, CostBreakdownItemDto>;

  @ApiProperty({ type: [CostTopUserDto] })
  topUsers: CostTopUserDto[];
}

export class CostTrendPointDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  costUsd: number;

  @ApiProperty()
  costNgn: number;

  @ApiProperty()
  tokensUsed: number;

  @ApiProperty()
  callCount: number;
}

export class CostTrendDto {
  @ApiProperty({ type: [CostTrendPointDto] })
  dailyTrend: CostTrendPointDto[];
}

export class UsageLedgerRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  userEmail?: string;

  @ApiProperty()
  module: string;

  @ApiProperty()
  actionType: string;

  @ApiProperty()
  tokensUsed: number;

  @ApiProperty()
  costUsd: number;

  @ApiProperty()
  costNgn: number;

  @ApiProperty({ required: false })
  operation?: string;

  @ApiProperty({ required: false })
  model?: string;

  @ApiProperty({ required: false })
  provider?: string;

  @ApiProperty({ required: false })
  estimated?: boolean;
}
