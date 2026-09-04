import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import {
  Subscription,
  SubscriptionStatus,
  BillingCycle,
} from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { PaystackService } from './paystack.service';
import { ConfigService } from '@nestjs/config';
import { DashboardEventService } from '../admin/services/dashboard-event.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private paystackService: PaystackService,
    private configService: ConfigService,
    private dataSource: DataSource,
    private dashboardEventService: DashboardEventService,
  ) {}

  /**
   * Create a payment intent for one-time payment
   */
  async createPaymentIntent(
    userId: string,
    amount: number,
    currency: 'NGN' | 'USD',
    metadata?: Record<string, any>,
  ): Promise<{ payment: Payment; authorizationUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create payment record
    const payment = this.paymentRepository.create({
      userId,
      amount,
      currency,
      type: PaymentType.OneTime,
      status: PaymentStatus.Pending,
      metadata,
    });

    await this.paymentRepository.save(payment);

    const callbackUrl = this.getPaymentsCallbackUrl();

    // Initialize Paystack transaction
    const paystackResponse = await this.paystackService.initializeTransaction({
      amount,
      email: user.email,
      currency,
      callback_url: callbackUrl,
      metadata: {
        ...metadata,
        paymentId: payment.id,
        userId,
      },
    });

    // Update payment with Paystack reference
    payment.paystackReference = paystackResponse.data.reference;
    await this.paymentRepository.save(payment);

    return {
      payment,
      authorizationUrl: paystackResponse.data.authorization_url,
    };
  }

  /**
   * Create a subscription intent
   */
  async createSubscriptionIntent(
    userId: string,
    billingCycle: BillingCycle,
    metadata?: Record<string, any>,
  ): Promise<{ subscription: Subscription; authorizationUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has an active or pending subscription
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: [
        { userId, status: SubscriptionStatus.Active },
        { userId, status: SubscriptionStatus.Pending },
      ],
    });

    if (existingSubscription) {
      throw new ConflictException('User already has an active subscription');
    }

    // Paystack plans are per-interval, so monthly and annual need distinct
    // codes. A single shared code billed everyone on the monthly plan while
    // recording a one-year period locally. PAYSTACK_PLAN_CODE remains the
    // fallback so existing single-plan deployments keep working.
    const fallbackPlanCode =
      this.configService.get<string>('PAYSTACK_PLAN_CODE');
    const planCode =
      billingCycle === BillingCycle.Annual
        ? (this.configService.get<string>('PAYSTACK_PLAN_CODE_ANNUAL') ??
          fallbackPlanCode)
        : (this.configService.get<string>('PAYSTACK_PLAN_CODE_MONTHLY') ??
          fallbackPlanCode);

    if (!planCode) {
      throw new BadRequestException(
        `Subscription plan not configured for ${billingCycle} billing`,
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === BillingCycle.Monthly) {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Create subscription record — pending until Paystack webhook confirms payment
    const subscription = this.subscriptionRepository.create({
      userId,
      planId: planCode,
      billingCycle,
      status: SubscriptionStatus.Pending,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    await this.subscriptionRepository.save(subscription);

    const callbackUrl = this.getPaymentsCallbackUrl();

    const paystackResponse = await this.paystackService.initializeTransaction({
      email: user.email,
      plan: planCode,
      callback_url: callbackUrl,
      metadata: {
        ...metadata,
        subscriptionId: subscription.id,
        userId,
        billingCycle,
      },
    });

    subscription.paystackReference = paystackResponse.data.reference;
    await this.subscriptionRepository.save(subscription);

    return {
      subscription,
      authorizationUrl: paystackResponse.data.authorization_url,
    };
  }

  /**
   * Process successful payment
   */
  async processSuccessfulPayment(
    paymentId: string,
    paystackReference: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.Success) {
      this.logger.warn(`Payment ${paymentId} already processed`);
      return payment; // Idempotency
    }

    // Verify with Paystack
    const verification =
      await this.paystackService.verifyTransaction(paystackReference);

    if (verification.data.status !== 'success') {
      throw new BadRequestException('Payment verification failed');
    }

    // Update payment status
    payment.status = PaymentStatus.Success;
    await this.paymentRepository.save(payment);

    // Add credits to user
    const creditsPerPayment = this.configService.get<number>(
      'CREDITS_PER_PAYMENT',
      1000,
    );
    await this.addCredits(payment.userId, creditsPerPayment);

    this.dashboardEventService.emitPaymentCompleted(
      payment.userId,
      Number(payment.amount),
      payment.currency,
    );

    this.logger.log(`Payment ${paymentId} processed successfully`);

    return payment;
  }

  /**
   * Process failed payment
   */
  async processFailedPayment(
    paymentId: string,
    reason?: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment.status = PaymentStatus.Failed;
    if (reason) {
      payment.metadata = {
        ...payment.metadata,
        failureReason: reason,
      };
    }
    await this.paymentRepository.save(payment);

    return payment;
  }

  /**
   * Process subscription payment (webhook)
   */
  async processSubscriptionPayment(
    subscriptionCode: string,
    paystackData: any,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { paystackSubscriptionCode: subscriptionCode },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Update subscription period
    subscription.currentPeriodStart = new Date(
      paystackData.current_period_start,
    );
    subscription.currentPeriodEnd = new Date(paystackData.current_period_end);
    subscription.status =
      paystackData.status === 'active'
        ? SubscriptionStatus.Active
        : SubscriptionStatus.Cancelled;

    await this.subscriptionRepository.save(subscription);

    if (subscription.status === SubscriptionStatus.Active) {
      await this.userRepository.update(subscription.userId, {
        subscriptionId: subscription.id,
      });
    }

    this.dashboardEventService.emitSubscriptionChanged(
      subscription.userId,
      subscription.status,
    );

    this.logger.log(
      `Subscription ${subscriptionCode} payment processed successfully`,
    );

    return subscription;
  }

  /**
   * Activate subscription after successful Paystack checkout (verify or webhook).
   */
  async activateSubscription(
    subscriptionId: string,
    paystackData?: {
      subscription_code?: string;
      customer_code?: string;
      current_period_start?: string | Date;
      current_period_end?: string | Date;
    },
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === SubscriptionStatus.Active) {
      return subscription;
    }

    subscription.status = SubscriptionStatus.Active;

    if (paystackData?.subscription_code) {
      subscription.paystackSubscriptionCode = paystackData.subscription_code;
    }
    if (paystackData?.customer_code) {
      subscription.paystackCustomerCode = paystackData.customer_code;
    }
    if (paystackData?.current_period_start) {
      subscription.currentPeriodStart = new Date(
        paystackData.current_period_start,
      );
    }
    if (paystackData?.current_period_end) {
      subscription.currentPeriodEnd = new Date(paystackData.current_period_end);
    }

    await this.subscriptionRepository.save(subscription);

    await this.userRepository.update(subscription.userId, {
      subscriptionId: subscription.id,
    });

    this.dashboardEventService.emitSubscriptionChanged(
      subscription.userId,
      subscription.status,
    );

    this.logger.log(`Subscription ${subscriptionId} activated`);

    return subscription;
  }

  /**
   * Verify Paystack checkout reference and activate subscription or one-time payment.
   */
  async verifyCheckout(
    userId: string,
    reference: string,
  ): Promise<{
    status: 'success' | 'pending' | 'failed';
    type: 'subscription' | 'payment' | 'unknown';
    subscription?: Subscription;
    payment?: Payment;
  }> {
    const verification =
      await this.paystackService.verifyTransaction(reference);

    const paystackStatus = verification.data.status;
    const metadata = verification.data.metadata ?? {};

    if (metadata.userId && metadata.userId !== userId) {
      throw new BadRequestException('Payment does not belong to this user');
    }

    if (metadata.subscriptionId) {
      const subscription = await this.subscriptionRepository.findOne({
        where: { id: metadata.subscriptionId, userId },
      });

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      if (paystackStatus === 'success') {
        const activated = await this.activateSubscription(subscription.id, {
          subscription_code:
            (metadata as any).subscription_code ??
            (verification.data as any).subscription?.subscription_code,
          customer_code: (verification.data as any).customer?.customer_code,
        });
        if (!activated.paystackReference) {
          activated.paystackReference = reference;
          await this.subscriptionRepository.save(activated);
        }
        return {
          status: 'success',
          type: 'subscription',
          subscription: activated,
        };
      }

      return {
        status: paystackStatus === 'failed' ? 'failed' : 'pending',
        type: 'subscription',
        subscription,
      };
    }

    const payment = await this.findPaymentByReference(reference);
    if (payment && payment.userId === userId) {
      if (
        paystackStatus === 'success' &&
        payment.status !== PaymentStatus.Success
      ) {
        const processed = await this.processSuccessfulPayment(
          payment.id,
          reference,
        );
        return { status: 'success', type: 'payment', payment: processed };
      }
      return {
        status:
          payment.status === PaymentStatus.Success
            ? 'success'
            : paystackStatus === 'failed'
              ? 'failed'
              : 'pending',
        type: 'payment',
        payment,
      };
    }

    return {
      status: paystackStatus === 'success' ? 'success' : 'pending',
      type: 'unknown',
    };
  }

  async markSubscriptionPaymentFailed(subscriptionCode: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { paystackSubscriptionCode: subscriptionCode },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.Expired;
    await this.subscriptionRepository.save(subscription);
    await this.userRepository.update(subscription.userId, {
      subscriptionId: null,
    });
    this.dashboardEventService.emitSubscriptionChanged(
      subscription.userId,
      subscription.status,
    );
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    userId: string,
    subscriptionId: string,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== SubscriptionStatus.Active) {
      throw new BadRequestException('Subscription is not active');
    }

    // Cancel in Paystack
    if (subscription.paystackSubscriptionCode) {
      try {
        await this.paystackService.cancelSubscription(
          subscription.paystackSubscriptionCode,
        );
      } catch (error) {
        this.logger.error('Error cancelling subscription in Paystack', error);
        // Continue with local cancellation even if Paystack fails
      }
    }

    // Update local subscription
    subscription.status = SubscriptionStatus.Cancelled;
    await this.subscriptionRepository.save(subscription);

    // Remove subscription reference from user
    await this.userRepository.update(userId, { subscriptionId: null });

    this.logger.log(`Subscription ${subscriptionId} cancelled`);
  }

  /**
   * Add credits to user account
   */
  async addCredits(userId: string, amount: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.credits = (user.credits || 0) + amount;
    await this.userRepository.save(user);

    this.logger.log(`Added ${amount} credits to user ${userId}`);

    return user;
  }

  /**
   * Deduct credits from user account
   */
  async deductCredits(userId: string, amount: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if ((user.credits || 0) < amount) {
      throw new BadRequestException('Insufficient credits');
    }

    user.credits = (user.credits || 0) - amount;
    await this.userRepository.save(user);

    this.logger.log(`Deducted ${amount} credits from user ${userId}`);

    return user;
  }

  /**
   * Get user payment history
   */
  async getPaymentHistory(userId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find payment by Paystack reference
   */
  async findPaymentByReference(reference: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { paystackReference: reference },
    });
  }

  /**
   * Find subscription by Paystack subscription code
   */
  async findSubscriptionByCode(
    subscriptionCode: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: { paystackSubscriptionCode: subscriptionCode },
    });
  }

  /**
   * Active subscription only — used for Pro daily credit limits.
   */
  async getActiveUserSubscription(
    userId: string,
  ): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: { userId, status: SubscriptionStatus.Active },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Latest subscription including pending checkout — for account UI.
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: [
        { userId, status: SubscriptionStatus.Active },
        { userId, status: SubscriptionStatus.Pending },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  private getPaymentsCallbackUrl(): string | undefined {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) return undefined;
    return `${frontendUrl.replace(/\/$/, '')}/payments/callback`;
  }
}
