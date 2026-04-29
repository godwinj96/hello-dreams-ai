import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreditGuard } from '../common/guards/credit.guard';
import { ThrottleAIGeneration } from '../common/decorators/throttle-ai.decorator';
import { JobApplicationService } from './job-application.service';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationsFilterDto } from './dto/application-response.dto';
import { JobApplicationStatus } from './entities/job-application.entity';

@ApiTags('job-application')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobApplicationController {
  constructor(private readonly service: JobApplicationService) {}

  // ── Search (no credit gate) ───────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Search jobs from multiple external sources' })
  async search(@Query() filters: SearchJobsDto) {
    return this.service.search(filters);
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get a cached job listing by ID' })
  async getListing(@Param('id') id: string) {
    return this.service.findListingById(id);
  }

  // ── Applications CRUD ─────────────────────────────────────────────────────

  @Get('applications')
  @ApiOperation({ summary: "List user's saved and applied jobs" })
  @ApiQuery({ name: 'status', enum: JobApplicationStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async listApplications(@Request() req, @Query() filters: ApplicationsFilterDto) {
    return this.service.listApplications(req.user.id, filters);
  }

  @Post('applications')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save a job (creates application with status=saved)' })
  async createApplication(@Request() req, @Body() dto: CreateApplicationDto) {
    return this.service.createApplication(req.user.id, dto);
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Get a single application with full job details' })
  async getApplication(@Param('id') id: string, @Request() req) {
    return this.service.findApplication(id, req.user.id);
  }

  @Patch('applications/:id')
  @ApiOperation({ summary: 'Update application status or notes' })
  async updateApplication(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.service.updateApplication(id, req.user.id, dto);
  }

  @Delete('applications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a saved job application' })
  async deleteApplication(@Param('id') id: string, @Request() req) {
    await this.service.deleteApplication(id, req.user.id);
  }

  // ── Document Generation (credit-gated) ────────────────────────────────────

  @Post('applications/:id/generate-documents')
  @ThrottleAIGeneration()
  @UseGuards(CreditGuard)
  @ApiOperation({ summary: 'Generate tailored resume + cover letter for this application' })
  async generateDocuments(@Param('id') id: string, @Request() req) {
    return this.service.generateDocuments(id, req.user.id, req.user);
  }

  @Get('applications/:id/documents')
  @ApiOperation({ summary: 'Get previously generated documents for this application' })
  async getDocuments(@Param('id') id: string, @Request() req) {
    return this.service.getDocuments(id, req.user.id);
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  @Post('applications/:id/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply to the job — via ATS API or returns redirect URL' })
  async apply(@Param('id') id: string, @Request() req) {
    return this.service.applyToJob(id, req.user.id, req.user);
  }
}
