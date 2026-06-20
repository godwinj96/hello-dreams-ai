import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../users/enums/role.enum';
import { CostsService } from '../services/costs.service';
import { CostSummaryDto, CostTrendDto } from '../dto/costs.dto';
import { TimeRangeDto } from '../dto/time-range.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin/costs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.Superuser)
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get AI cost summary with breakdowns' })
  @ApiResponse({ status: 200, type: CostSummaryDto })
  async getSummary(@Query() timeRange?: TimeRangeDto): Promise<CostSummaryDto> {
    return this.costsService.getSummary(timeRange);
  }

  @Get('trend')
  @ApiOperation({ summary: 'Get daily AI cost trend' })
  @ApiResponse({ status: 200, type: CostTrendDto })
  async getTrend(@Query() timeRange?: TimeRangeDto): Promise<CostTrendDto> {
    return this.costsService.getTrend(timeRange);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Get paginated AI usage ledger' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'operation', required: false })
  @ApiQuery({ name: 'actionType', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async getLedger(
    @Query() timeRange: TimeRangeDto,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('module') module?: string,
    @Query('operation') operation?: string,
    @Query('actionType') actionType?: string,
    @Query('userId') userId?: string,
  ) {
    return this.costsService.getLedger({
      timeRange,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      module,
      operation,
      actionType,
      userId,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export AI usage ledger as CSV' })
  async exportCsv(
    @Query() timeRange: TimeRangeDto,
    @Query('module') module?: string,
    @Query('operation') operation?: string,
    @Query('actionType') actionType?: string,
    @Query('userId') userId?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const csv = await this.costsService.exportCsv({
      timeRange,
      module,
      operation,
      actionType,
      userId,
    });
    const filename = `ai-costs-${new Date().toISOString().slice(0, 10)}.csv`;
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.send(csv);
  }
}
