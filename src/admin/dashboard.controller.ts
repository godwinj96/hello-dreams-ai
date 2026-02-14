import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
  Header,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { DashboardService } from './services/dashboard.service';
import { DashboardEventService } from './services/dashboard-event.service';
import { UsageTrackingService } from './services/usage-tracking.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { TimeRangeDto } from './dto/time-range.dto';
import { MetricEventDto } from './dto/metric-event.dto';
import { UserDailyStatsDto } from './dto/user-daily-stats.dto';
import { UUIDValidationPipe } from '../common/pipes/uuid-validation.pipe';
import { interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.Superuser)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dashboardEventService: DashboardEventService,
    private readonly usageTrackingService: UsageTrackingService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description: 'Returns comprehensive dashboard statistics for admin users',
  })
  @ApiQuery({ name: 'timeRange', required: false, enum: ['today', 'week', 'month', 'year', 'custom'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics',
    type: DashboardStatsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getDashboardStats(
    @Request() req,
    @Query() timeRange?: TimeRangeDto,
  ): Promise<DashboardStatsDto> {
    return this.dashboardService.getDashboardStats(req.user.id, timeRange);
  }

  @Get('stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiOperation({
    summary: 'Server-Sent Events stream for real-time dashboard updates',
    description:
      'Establishes an SSE connection that streams dashboard metric updates in real-time. Events are sent when metrics change (user registrations, feature usage, etc.). Includes heartbeat every 30 seconds.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async streamDashboard(@Request() req, @Res() res: any): Promise<void> {
    // Set up SSE connection
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx

    const closeSubject = new Subject<void>();

    // Subscribe to event stream
    const subscription = this.dashboardEventService
      .getEventStream()
      .pipe(takeUntil(closeSubject))
      .subscribe({
        next: (event: MetricEventDto) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
        error: (err) => {
          console.error('SSE error:', err);
          res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
        },
      });

    // Send heartbeat every 30 seconds
    const heartbeatInterval = interval(30000)
      .pipe(takeUntil(closeSubject))
      .subscribe(() => {
        this.dashboardEventService.emitHeartbeat();
      });

    // Handle client disconnect
    req.on('close', () => {
      closeSubject.next();
      closeSubject.complete();
      subscription.unsubscribe();
      heartbeatInterval.unsubscribe();
      res.end();
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`);
  }

  @Get('users/:id/stats')
  @ApiOperation({
    summary: 'Get daily usage stats for a specific user',
    description: 'Returns daily breakdown of tokens and costs for a user. Used for detecting overuse.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO string)' })
  @ApiResponse({
    status: 200,
    description: 'User daily usage stats',
    type: UserDailyStatsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getUserDailyStats(
    @Request() req,
    @Param('id', UUIDValidationPipe) userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<UserDailyStatsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.usageTrackingService.getUserDailyStats(userId, start, end);
  }
}


