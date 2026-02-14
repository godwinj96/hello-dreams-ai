import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface InitializeTransactionDto {
  amount: number; // in kobo (NGN) or cents (USD)
  email: string;
  currency?: 'NGN' | 'USD';
  metadata?: Record<string, any>;
  callback_url?: string;
}

export interface InitializeSubscriptionDto {
  plan: string; // Paystack plan code
  email: string;
  metadata?: Record<string, any>;
}

export interface PaystackTransactionResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackSubscriptionResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    subscription_code: string;
    customer_code: string;
  };
}

export interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    customer: {
      email: string;
    };
    metadata?: Record<string, any>;
  };
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly axiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    this.publicKey = this.configService.get<string>('PAYSTACK_PUBLIC_KEY') || '';

    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set. Paystack services will not work.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Initialize a transaction (one-time payment)
   */
  async initializeTransaction(
    dto: InitializeTransactionDto,
  ): Promise<PaystackTransactionResponse> {
    if (!this.secretKey) {
      throw new BadRequestException('Paystack is not configured');
    }

    try {
      const amountInKobo = Math.round(dto.amount * 100); // Convert to kobo/cents

      const response = await this.axiosInstance.post('/transaction/initialize', {
        amount: amountInKobo,
        email: dto.email,
        currency: dto.currency || 'NGN',
        metadata: dto.metadata,
        callback_url: dto.callback_url,
      });

      if (!response.data.status) {
        throw new BadRequestException(
          response.data.message || 'Failed to initialize transaction',
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error('Error initializing Paystack transaction', error);
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          error.response?.data?.message || 'Failed to initialize transaction',
        );
      }
      throw error;
    }
  }

  /**
   * Initialize a subscription
   */
  async initializeSubscription(
    dto: InitializeSubscriptionDto,
  ): Promise<PaystackSubscriptionResponse> {
    if (!this.secretKey) {
      throw new BadRequestException('Paystack is not configured');
    }

    try {
      const response = await this.axiosInstance.post('/subscription', {
        customer: dto.email,
        plan: dto.plan,
        metadata: dto.metadata,
      });

      if (!response.data.status) {
        throw new BadRequestException(
          response.data.message || 'Failed to initialize subscription',
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error('Error initializing Paystack subscription', error);
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          error.response?.data?.message || 'Failed to initialize subscription',
        );
      }
      throw error;
    }
  }

  /**
   * Verify a transaction
   */
  async verifyTransaction(reference: string): Promise<VerifyTransactionResponse> {
    if (!this.secretKey) {
      throw new BadRequestException('Paystack is not configured');
    }

    try {
      const response = await this.axiosInstance.get(`/transaction/verify/${reference}`);

      if (!response.data.status) {
        throw new BadRequestException(
          response.data.message || 'Failed to verify transaction',
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error('Error verifying Paystack transaction', error);
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          error.response?.data?.message || 'Failed to verify transaction',
        );
      }
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionCode: string): Promise<any> {
    if (!this.secretKey) {
      throw new BadRequestException('Paystack is not configured');
    }

    try {
      const response = await this.axiosInstance.get(`/subscription/${subscriptionCode}`);

      if (!response.data.status) {
        throw new BadRequestException(
          response.data.message || 'Failed to get subscription',
        );
      }

      return response.data.data;
    } catch (error) {
      this.logger.error('Error getting Paystack subscription', error);
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          error.response?.data?.message || 'Failed to get subscription',
        );
      }
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionCode: string,
    emailToken?: string,
  ): Promise<any> {
    if (!this.secretKey) {
      throw new BadRequestException('Paystack is not configured');
    }

    try {
      const response = await this.axiosInstance.post(
        `/subscription/disable`,
        {
          code: subscriptionCode,
          token: emailToken,
        },
      );

      if (!response.data.status) {
        throw new BadRequestException(
          response.data.message || 'Failed to cancel subscription',
        );
      }

      return response.data.data;
    } catch (error) {
      this.logger.error('Error cancelling Paystack subscription', error);
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          error.response?.data?.message || 'Failed to cancel subscription',
        );
      }
      throw error;
    }
  }
}




