import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../users/enums/role.enum';
import { AdminPaymentsService } from '../services/admin-payments.service';
import {
  PaymentAdminFiltersDto,
  PaymentStatsQueryDto,
  SubscriptionAdminFiltersDto,
} from '../dto/payment-admin-filters.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.Superuser)
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get payment and subscription statistics' })
  @ApiResponse({ status: 200, description: 'Payment statistics' })
  getPaymentStats(@Query() query: PaymentStatsQueryDto) {
    return this.adminPaymentsService.getPaymentStats(query);
  }

  @Get()
  @ApiOperation({ summary: 'List all payments (admin)' })
  @ApiResponse({ status: 200, description: 'Paginated payment list' })
  listPayments(@Query() filters: PaymentAdminFiltersDto) {
    return this.adminPaymentsService.listPayments(filters);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List all subscriptions (admin)' })
  @ApiResponse({ status: 200, description: 'Paginated subscription list' })
  listSubscriptions(@Query() filters: SubscriptionAdminFiltersDto) {
    return this.adminPaymentsService.listSubscriptions(filters);
  }
}
