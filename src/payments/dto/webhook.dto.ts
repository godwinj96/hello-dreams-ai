
import { ApiProperty } from '@nestjs/swagger';

export class PaystackWebhookDto {
  @ApiProperty()
  event: string;

  @ApiProperty()
  data: {
    id?: number;
    domain?: string;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    customer?: {
      id?: number;
      email?: string;
    };
    authorization?: {
      authorization_code?: string;
      bin?: string;
      last4?: string;
      exp_month?: string;
      exp_year?: string;
      channel?: string;
      card_type?: string;
      bank?: string;
      country_code?: string;
      brand?: string;
      reusable?: boolean;
      signature?: string;
      account_name?: string;
    };
    plan?: {
      id?: number;
      name?: string;
      plan_code?: string;
      amount?: number;
      interval?: string;
      currency?: string;
    };
    subscription?: {
      id?: number;
      subscription_code?: string;
      customer?: {
        id?: number;
        email?: string;
      };
      plan?: {
        id?: number;
        plan_code?: string;
      };
      status?: string;
      current_period_start?: string;
      current_period_end?: string;
    };
    metadata?: Record<string, any>;
  };
}





