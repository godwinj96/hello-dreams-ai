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
    description: `**Get Dashboard Statistics**

Retrieve comprehensive dashboard statistics for admin users. Supports filtering by time range.

**Time Range Options:**
- \`today\`: Statistics for today only
- \`week\`: Statistics for the past 7 days
- \`month\`: Statistics for the past 30 days
- \`year\`: Statistics for the past 365 days
- \`custom\`: Use \`startDate\` and \`endDate\` query parameters for custom range

**Example Requests:**
- \`GET /admin/dashboard/stats?timeRange=today\`
- \`GET /admin/dashboard/stats?timeRange=week\`
- \`GET /admin/dashboard/stats?timeRange=custom&startDate=2024-01-01&endDate=2024-01-31\`

**Statistics Included:**
- Total users
- Active users
- New registrations
- Feature usage counts
- Payment statistics
- Subscription statistics
- Revenue metrics
- And more...

**Note:** Requires admin or superuser role`,
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    enum: ['today', 'week', 'month', 'year', 'custom'],
    description: 'Time range for statistics. Use "custom" with startDate and endDate for custom ranges.',
    example: 'week',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for custom time range (ISO 8601 format). Only used when timeRange=custom.',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for custom time range (ISO 8601 format). Only used when timeRange=custom.',
    example: '2024-01-31T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
    type: DashboardStatsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin or Superuser access required' })
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
    description: `**Real-Time Dashboard Updates via SSE**

Establishes a Server-Sent Events (SSE) connection that streams dashboard metric updates in real-time. This allows the frontend to receive live updates without polling.

**How It Works:**
1. Frontend opens SSE connection to this endpoint
2. Server sends initial connection message
3. Server streams metric updates as they occur:
   - User registrations
   - Feature usage events
   - Payment events
   - Subscription changes
   - Any other dashboard-relevant events
4. Heartbeat sent every 30 seconds to keep connection alive
5. Connection closes when client disconnects

**Event Format:**
\`\`\`
data: {"type": "user_registered", "userId": "uuid", "timestamp": "2024-01-15T10:30:00.000Z"}

data: {"type": "heartbeat", "timestamp": "2024-01-15T10:30:30.000Z"}

data: {"type": "feature_used", "feature": "headshot-generator", "userId": "uuid"}
\`\`\`

**Frontend Implementation Example (JavaScript):**
\`\`\`javascript
const eventSource = new EventSource('/admin/dashboard/stream', {
  headers: {
    'Authorization': 'Bearer ' + accessToken
  }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update dashboard with new data
  updateDashboard(data);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  // Handle reconnection
};
\`\`\`

**Note:** 
- Requires admin or superuser role
- Connection automatically closes on client disconnect
- Reconnect automatically if connection drops
- Heartbeat ensures connection stays alive`,
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established - Connection remains open for real-time updates',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin or Superuser access required' })
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
    description: `**Get User Daily Usage Statistics**

Retrieve daily breakdown of AI usage (tokens, costs, API calls) for a specific user. Useful for:
- Detecting overuse or abuse
- Monitoring user activity
- Cost analysis per user
- Identifying power users

**Usage Metrics Tracked:**
- Daily token usage
- API call counts
- Cost per day
- Feature usage breakdown
- Peak usage times

**Example Request:**
\`GET /admin/dashboard/users/123e4567-e89b-12d3-a456-426614174000/stats?startDate=2024-01-01&endDate=2024-01-31\`

**Example Response:**
\`\`\`json
{
  "userId": "user-uuid",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.999Z",
  "dailyStats": [
    {
      "date": "2024-01-15",
      "tokensUsed": 15000,
      "apiCalls": 45,
      "cost": 0.15,
      "features": {
        "resume-builder": 20,
        "headshot-generator": 5,
        "document-generator": 20
      }
    }
  ],
  "totals": {
    "totalTokens": 450000,
    "totalApiCalls": 1350,
    "totalCost": 4.50
  }
}
\`\`\`

**Note:** Requires admin or superuser role`,
  })
  @ApiParam({
    name: 'id',
    description: 'User ID (UUID) to get statistics for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for statistics range (ISO 8601 format). Defaults to 30 days ago if not provided.',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for statistics range (ISO 8601 format). Defaults to today if not provided.',
    example: '2024-01-31T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'User daily usage statistics retrieved successfully',
    type: UserDailyStatsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin or Superuser access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
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


