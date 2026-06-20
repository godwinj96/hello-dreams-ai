import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
  UnauthorizedException,
  BadRequestException,
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
  @ApiOperation({
    summary: 'Initialize one-time payment',
    description: `**Initialize One-Time Payment**

Start a one-time payment process using Paystack. This endpoint creates a payment intent and returns an authorization URL where the user can complete the payment.

**Payment Flow:**
1. Call this endpoint with amount and currency
2. Receive \`authorizationUrl\` in response
3. Redirect user to \`authorizationUrl\`
4. User completes payment on Paystack
5. Paystack sends webhook to \`POST /payments/webhook\`
6. Payment status is automatically updated

**Supported Currencies:**
- NGN (Nigerian Naira) - Default
- Other currencies supported by Paystack

**Example Request:**
\`\`\`json
{
  "amount": 5000,
  "currency": "NGN",
  "metadata": {
    "description": "Premium subscription",
    "userId": "user-uuid"
  }
}
\`\`\`

**Example Response:**
\`\`\`json
{
  "authorizationUrl": "https://paystack.com/pay/xxxxx",
  "payment": {
    "id": "payment-uuid",
    "userId": "user-uuid",
    "amount": 5000,
    "currency": "NGN",
    "status": "pending",
    "reference": "paystack-reference-code"
  }
}
\`\`\`

**Note:** The webhook automatically updates payment status. You can check status using \`GET /payments/history\`.`,
  })
  @ApiBody({ type: InitializePaymentDto })
  @ApiResponse({
    status: 201,
    description:
      'Payment initialized successfully - Redirect user to authorizationUrl',
    type: InitializePaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request - Invalid amount, currency, or missing required fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
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
  @ApiOperation({
    summary: 'Initialize subscription payment',
    description: `**Initialize Subscription**

Start a subscription payment process. This creates a recurring payment plan that will automatically charge the user on a monthly or yearly basis.

**Subscription Flow:**
1. Call this endpoint with billing cycle
2. Receive \`authorizationUrl\` in response
3. Redirect user to \`authorizationUrl\`
4. User authorizes recurring payment on Paystack
5. Paystack sends webhook to confirm subscription
6. Subscription is automatically activated

**Billing Cycles:**
- \`monthly\`: Recurring monthly payments
- \`yearly\`: Recurring yearly payments

**Example Request:**
\`\`\`json
{
  "billingCycle": "monthly",
  "metadata": {
    "plan": "premium",
    "features": ["unlimited-resumes", "priority-support"]
  }
}
\`\`\`

**Example Response:**
\`\`\`json
{
  "authorizationUrl": "https://paystack.com/pay/subscription-xxxxx",
  "subscription": {
    "id": "subscription-uuid",
    "userId": "user-uuid",
    "billingCycle": "monthly",
    "status": "pending",
    "subscriptionCode": "paystack-subscription-code"
  }
}
\`\`\`

**Note:** 
- User must not have an active subscription (returns 409 if active subscription exists)
- Webhook automatically activates subscription after authorization
- Check subscription status using \`GET /payments/subscription\``,
  })
  @ApiBody({ type: InitializeSubscriptionDto })
  @ApiResponse({
    status: 201,
    description:
      'Subscription initialized successfully - Redirect user to authorizationUrl',
    type: InitializeSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request - Invalid billing cycle or missing required fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description:
      'User already has an active subscription - Cancel existing subscription first',
  })
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
  @ApiOperation({
    summary: 'Paystack webhook handler',
    description: `**Paystack Webhook Endpoint**

This endpoint receives webhook events from Paystack to update payment and subscription statuses. This is called automatically by Paystack - frontend developers do not need to call this endpoint.

**Webhook Events Handled:**
- \`charge.success\`: Payment completed successfully
- \`charge.failed\`: Payment failed
- \`subscription.create\`: Subscription created
- \`subscription.enable\`: Subscription activated
- \`subscription.disable\`: Subscription cancelled
- \`invoice.payment_failed\`: Subscription payment failed

**Security:**
- Webhook signature is verified using \`x-paystack-signature\` header
- Invalid signatures are rejected

**Note:** This endpoint is public (no authentication required) as it's called by Paystack servers.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Webhook processed successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook signature or payload',
  })
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
      throw new UnauthorizedException('Invalid webhook signature');
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
      const metadata = payload.data.metadata ?? {};
      if (metadata.subscriptionId) {
        await this.paymentsService.activateSubscription(
          metadata.subscriptionId,
          {
            subscription_code: payload.data.subscription?.subscription_code,
            customer_code: (payload.data.customer as { customer_code?: string })
              ?.customer_code,
            current_period_start:
              payload.data.subscription?.current_period_start,
            current_period_end: payload.data.subscription?.current_period_end,
          },
        );
        return;
      }

      const subscriptionCode = payload.data.subscription?.subscription_code;
      if (subscriptionCode) {
        const subscription =
          await this.paymentsService.findSubscriptionByCode(subscriptionCode);
        if (subscription) {
          const subscriptionData = payload.data.subscription ?? payload.data;
          await this.paymentsService.processSubscriptionPayment(
            subscriptionCode,
            {
              ...subscriptionData,
              status: subscriptionData.status ?? 'active',
            },
          );
          return;
        }
      }

      const payment =
        await this.paymentsService.findPaymentByReference(reference);
      if (payment) {
        await this.paymentsService.processSuccessfulPayment(
          payment.id,
          reference,
        );
      }
    } catch (error) {
      console.error('Error handling successful payment webhook', error);
    }
  }

  private async handleFailedPayment(payload: PaystackWebhookDto) {
    const reference = payload.data.reference;
    if (!reference) return;

    try {
      const payment =
        await this.paymentsService.findPaymentByReference(reference);
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
    const metadata = payload.data.metadata ?? {};

    try {
      if (metadata.subscriptionId) {
        await this.paymentsService.activateSubscription(
          metadata.subscriptionId,
          {
            subscription_code: subscriptionCode,
            customer_code: (payload.data.customer as { customer_code?: string })
              ?.customer_code,
            current_period_start: payload.data.subscription?.current_period_start,
            current_period_end: payload.data.subscription?.current_period_end,
          },
        );
        return;
      }

      if (!subscriptionCode) return;

      const subscriptionData = payload.data.subscription ?? payload.data;
      await this.paymentsService.processSubscriptionPayment(
        subscriptionCode,
        subscriptionData,
      );
    } catch (error) {
      console.error('Error handling subscription webhook', error);
    }
  }

  private async handleSubscriptionCancelled(payload: PaystackWebhookDto) {
    const subscriptionCode = payload.data.subscription?.subscription_code;
    if (!subscriptionCode) return;

    try {
      const subscription =
        await this.paymentsService.findSubscriptionByCode(subscriptionCode);
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
    const subscriptionCode = payload.data.subscription?.subscription_code;
    if (!subscriptionCode) return;

    try {
      await this.paymentsService.markSubscriptionPaymentFailed(subscriptionCode);
    } catch (error) {
      console.error('Error handling subscription payment failure', error);
    }
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Verify Paystack checkout reference' })
  async verifyCheckout(
    @Request() req,
    @Query('reference') reference: string,
  ) {
    if (!reference) {
      throw new BadRequestException('reference is required');
    }
    return this.paymentsService.verifyCheckout(req.user.id, reference);
  }
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get user payment history',
    description: `**Get Payment History**

Retrieve all payment transactions for the authenticated user, ordered by creation date (newest first).

**Use Cases:**
- Display payment history in user dashboard
- Show transaction receipts
- Track payment statuses

**Example Response:**
\`\`\`json
[
  {
    "id": "payment-uuid",
    "userId": "user-uuid",
    "amount": 5000,
    "currency": "NGN",
    "status": "completed",
    "reference": "paystack-ref-123",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
\`\`\``,
  })
  @ApiResponse({
    status: 200,
    description: 'Payment history retrieved successfully',
    type: [PaymentResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async getPaymentHistory(@Request() req): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentsService.getPaymentHistory(req.user.id);
    return payments.map((p) => PaymentResponseDto.fromEntity(p));
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get user current subscription',
    description: `**Get Current Subscription**

Retrieve the active subscription for the authenticated user. Returns \`null\` if the user has no active subscription.

**Subscription Statuses:**
- \`active\`: Subscription is active and payments are being processed
- \`pending\`: Subscription created but not yet activated
- \`cancelled\`: Subscription has been cancelled
- \`expired\`: Subscription has expired

**Example Response (Active Subscription):**
\`\`\`json
{
  "id": "subscription-uuid",
  "userId": "user-uuid",
  "billingCycle": "monthly",
  "status": "active",
  "subscriptionCode": "paystack-subscription-code",
  "startDate": "2024-01-15T10:30:00.000Z",
  "nextBillingDate": "2024-02-15T10:30:00.000Z"
}
\`\`\`

**Example Response (No Subscription):**
\`\`\`json
null
\`\`\``,
  })
  @ApiResponse({
    status: 200,
    description:
      'Current subscription retrieved (may be null if no active subscription)',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async getSubscription(
    @Request() req,
  ): Promise<SubscriptionResponseDto | null> {
    const subscription = await this.paymentsService.getUserSubscription(
      req.user.id,
    );
    return subscription
      ? SubscriptionResponseDto.fromEntity(subscription)
      : null;
  }

  @Delete('subscription/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel subscription',
    description: `**Cancel Subscription**

Cancel an active subscription. The subscription will be immediately cancelled and no further payments will be processed.

**What Happens:**
- Subscription status is set to \`cancelled\`
- Paystack is notified to stop recurring charges
- User retains access until the end of the current billing period (typically)
- Webhook is sent to confirm cancellation

**Example:**
\`DELETE /payments/subscription/123e4567-e89b-12d3-a456-426614174000\`

**Response:** 204 No Content (successful cancellation)`,
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID (UUID) from GET /payments/subscription',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Subscription cancelled successfully - No content returned',
  })
  @ApiResponse({
    status: 404,
    description:
      'Subscription not found - Invalid subscription ID or subscription belongs to another user',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async cancelSubscription(
    @Request() req,
    @Param('id', UUIDValidationPipe) id: string,
  ): Promise<void> {
    await this.paymentsService.cancelSubscription(req.user.id, id);
  }
}
