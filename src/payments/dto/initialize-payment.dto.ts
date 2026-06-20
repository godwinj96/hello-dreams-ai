import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({
    description: 'Amount to pay',
    example: 5000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Currency',
    enum: ['NGN', 'USD'],
    default: 'NGN',
    required: false,
  })
  @IsEnum(['NGN', 'USD'])
  @IsOptional()
  currency?: 'NGN' | 'USD';

  @ApiProperty({
    description: 'Additional metadata to attach to the payment',
    required: false,
    example: {
      description: 'Premium subscription payment',
      plan: 'premium',
      userId: 'user-uuid',
      features: ['unlimited-resumes', 'priority-support'],
    },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
