import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { InitializeSubscriptionDto } from './dto/initialize-subscription.dto';
import {
  PaymentResponseDto,
  SubscriptionResponseDto,
  InitializePaymentResponseDto,
  InitializeSubscriptionResponseDto,
} from './dto/payment-response.dto';
import { PaystackWebhookDto } from './dto/webhook.dto';
import { UUIDValidationPipe } from '../common/pipes/uuid-validation.pipe';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paystackService: PaystackService,
  ) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Initialize one-time payment' })
  @ApiBody({ type: InitializePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Payment initialized successfully',
    type: InitializePaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async initializePayment(
    @Request() req,
    @Body() dto: InitializePaymentDto,
  ): Promise<InitializePaymentResponseDto> {
    const result = await this.paymentsService.createPaymentIntent(
      req.user.id,
      dto.amount,
      dto.currency || 'NGN',
      dto.metadata,
    );

    return {
      authorizationUrl: result.authorizationUrl,
      payment: PaymentResponseDto.fromEntity(result.payment),
    };
  }

  @Post('subscription/initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Initialize subscription payment' })
  @ApiBody({ type: InitializeSubscriptionDto })
  @ApiResponse({
    status: 201,
    description: 'Subscription initialized successfully',
    type: InitializeSubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User already has active subscription' })
  async initializeSubscription(
    @Request() req,
    @Body() dto: InitializeSubscriptionDto,
  ): Promise<InitializeSubscriptionResponseDto> {
    const result = await this.paymentsService.createSubscriptionIntent(
      req.user.id,
      dto.billingCycle,
      dto.metadata,
    );

    return {
      authorizationUrl: result.authorizationUrl,
      subscription: SubscriptionResponseDto.fromEntity(result.subscription),
    };
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
    @Body() payload: PaystackWebhookDto,
  ): Promise<{ message: string }> {
    // Verify webhook signature
    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);
    const isValid = this.paystackService.verifyWebhookSignature(
      rawBody,
      signature,
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Handle different event types
    switch (payload.event) {
      case 'charge.success':
        await this.handleSuccessfulPayment(payload);
        break;
      case 'charge.failed':
        await this.handleFailedPayment(payload);
        break;
      case 'subscription.create':
      case 'subscription.enable':
        await this.handleSubscriptionCreated(payload);
        break;
      case 'subscription.disable':
        await this.handleSubscriptionCancelled(payload);
        break;
      case 'invoice.payment_failed':
        await this.handleSubscriptionPaymentFailed(payload);
        break;
      default:
        // Log unhandled events but don't fail
        console.log(`Unhandled webhook event: ${payload.event}`);
    }

    return { message: 'Webhook processed successfully' };
  }

  private async handleSuccessfulPayment(payload: PaystackWebhookDto) {
    const reference = payload.data.reference;
    if (!reference) return;

    try {
      const payment = await this.paymentsService.findPaymentByReference(reference);
      if (payment) {
        await this.paymentsService.processSuccessfulPayment(payment.id, reference);
      }
    } catch (error) {
      console.error('Error handling successful payment webhook', error);
    }
  }

  private async handleFailedPayment(payload: PaystackWebhookDto) {
    const reference = payload.data.reference;
    if (!reference) return;

    try {
      const payment = await this.paymentsService.findPaymentByReference(reference);
      if (payment) {
        await this.paymentsService.processFailedPayment(
          payment.id,
          payload.data.status || 'Payment failed',
        );
      }
    } catch (error) {
      console.error('Error handling failed payment webhook', error);
    }
  }

  private async handleSubscriptionCreated(payload: PaystackWebhookDto) {
    const subscriptionCode = payload.data.subscription?.subscription_code;
    if (!subscriptionCode) return;

    // Subscription is already created in initializeSubscription
    // This webhook just confirms it
    console.log(`Subscription ${subscriptionCode} confirmed`);
  }

  private async handleSubscriptionCancelled(payload: PaystackWebhookDto) {
    const subscriptionCode = payload.data.subscription?.subscription_code;
    if (!subscriptionCode) return;

    try {
      const subscription = await this.paymentsService.findSubscriptionByCode(
        subscriptionCode,
      );
      if (subscription) {
        await this.paymentsService.cancelSubscription(
          subscription.userId,
          subscription.id,
        );
      }
    } catch (error) {
      console.error('Error handling subscription cancellation webhook', error);
    }
  }

  private async handleSubscriptionPaymentFailed(payload: PaystackWebhookDto) {
    // Handle failed subscription payment
    console.log('Subscription payment failed', payload.data);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user payment history' })
  @ApiResponse({
    status: 200,
    description: 'Payment history',
    type: [PaymentResponseDto],
  })
  async getPaymentHistory(@Request() req): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentsService.getPaymentHistory(req.user.id);
    return payments.map((p) => PaymentResponseDto.fromEntity(p));
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user current subscription' })
  @ApiResponse({
    status: 200,
    description: 'Current subscription',
    type: SubscriptionResponseDto,
  })
  async getSubscription(
    @Request() req,
  ): Promise<SubscriptionResponseDto | null> {
    const subscription = await this.paymentsService.getUserSubscription(
      req.user.id,
    );
    return subscription ? SubscriptionResponseDto.fromEntity(subscription) : null;
  }

  @Delete('subscription/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({ status: 204, description: 'Subscription cancelled' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async cancelSubscription(
    @Request() req,
    @Param('id', UUIDValidationPipe) id: string,
  ): Promise<void> {
    await this.paymentsService.cancelSubscription(req.user.id, id);
  }
}

