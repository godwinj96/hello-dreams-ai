import { ApiProperty } from '@nestjs/swagger';
import {
  Payment,
  PaymentStatus,
  PaymentType,
} from '../entities/payment.entity';
import {
  Subscription,
  SubscriptionStatus,
  BillingCycle,
} from '../entities/subscription.entity';

export class PaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ nullable: true })
  paystackReference: string | null;

  @ApiProperty({ enum: PaymentType })
  type: PaymentType;

  @ApiProperty({ nullable: true })
  metadata: Record<string, any> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paystackReference: payment.paystackReference,
      type: payment.type,
      metadata: payment.metadata,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

export class SubscriptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  planId: string;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty({ enum: BillingCycle })
  billingCycle: BillingCycle;

  @ApiProperty()
  currentPeriodStart: Date;

  @ApiProperty()
  currentPeriodEnd: Date;

  @ApiProperty({ nullable: true })
  paystackSubscriptionCode: string | null;

  @ApiProperty({ nullable: true })
  paystackCustomerCode: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(subscription: Subscription): SubscriptionResponseDto {
    return {
      id: subscription.id,
      userId: subscription.userId,
      planId: subscription.planId,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      paystackSubscriptionCode: subscription.paystackSubscriptionCode,
      paystackCustomerCode: subscription.paystackCustomerCode,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}

export class InitializePaymentResponseDto {
  @ApiProperty()
  authorizationUrl: string;

  @ApiProperty()
  payment: PaymentResponseDto;
}

export class InitializeSubscriptionResponseDto {
  @ApiProperty()
  authorizationUrl: string;

  @ApiProperty()
  subscription: SubscriptionResponseDto;
}
