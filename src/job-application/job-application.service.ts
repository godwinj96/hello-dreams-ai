import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JobApplication,
  JobApplicationStatus,
} from './entities/job-application.entity';
import { JobListing } from './entities/job-listing.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import {
  ApplicationResponseDto,
  ApplicationsFilterDto,
} from './dto/application-response.dto';
import { JobListingResponseDto } from './dto/job-listing-response.dto';
import { JobSearchService } from './services/job-search.service';
import { JobApplyService } from './services/job-apply.service';
import { JobDocumentGeneratorService } from './services/job-document-generator.service';
import { ApplyJobResponseDto } from './dto/apply-job.dto';
import { User } from '../users/entities/user.entity';
import { AiCostTrackingService } from '../admin/services/ai-cost-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';

@Injectable()
export class JobApplicationService {
  private readonly logger = new Logger(JobApplicationService.name);

  constructor(
    @InjectRepository(JobApplication)
    private applicationRepository: Repository<JobApplication>,
    @InjectRepository(JobListing)
    private listingRepository: Repository<JobListing>,
    private jobSearchService: JobSearchService,
    private jobApplyService: JobApplyService,
    private jobDocumentGenerator: JobDocumentGeneratorService,
    private aiCostTrackingService: AiCostTrackingService,
    private dashboardEventService: DashboardEventService,
  ) {}

  // ── Search ────────────────────────────────────────────────────────────────

  async search(filters: any, userId?: string) {
    return this.jobSearchService.search(filters, userId);
  }

  async findListingById(
    id: string,
    userId?: string,
  ): Promise<JobListingResponseDto> {
    const dto = await this.jobSearchService.findById(id, userId);
    if (!dto) throw new NotFoundException(`Job listing ${id} not found`);
    return dto;
  }

  // ── Applications CRUD ─────────────────────────────────────────────────────

  async createApplication(
    userId: string,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    let listing: JobListing;

    if (dto.jobListingId) {
      const found = await this.listingRepository.findOne({
        where: { id: dto.jobListingId },
      });
      if (!found)
        throw new NotFoundException(
          `Job listing ${dto.jobListingId} not found`,
        );
      listing = found;
    } else if (dto.jobData) {
      // Upsert listing from inline data
      const existing = dto.jobData.sourceUrl
        ? await this.listingRepository.findOne({
            where: { sourceUrl: dto.jobData.sourceUrl },
          })
        : null;

      if (existing) {
        listing = existing;
      } else {
        listing = await this.listingRepository.save(
          this.listingRepository.create({
            ...dto.jobData,
            cachedAt: new Date(),
          }),
        );
      }
    } else {
      throw new BadRequestException('Provide either jobListingId or jobData');
    }

    // Check for duplicate save
    const existing = await this.applicationRepository.findOne({
      where: { userId, jobListingId: listing.id },
    });
    if (existing) {
      return this.toDtoForUser(existing, listing, userId);
    }

    const application = await this.applicationRepository.save(
      this.applicationRepository.create({
        userId,
        jobListingId: listing.id,
        status: JobApplicationStatus.Saved,
        notes: dto.notes,
      }),
    );

    this.dashboardEventService.emitFeatureUsed(
      userId,
      'job-application',
      'job_saved',
    );

    return this.toDtoForUser(application, listing, userId);
  }

  async listApplications(
    userId: string,
    filters: ApplicationsFilterDto,
  ): Promise<{ data: ApplicationResponseDto[]; meta: any }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (filters.status) where.status = filters.status;

    const [applications, total] = await this.applicationRepository.findAndCount(
      {
        where,
        relations: ['jobListing'],
        order: { updatedAt: 'DESC' },
        skip,
        take: limit,
      },
    );

    const matchContext =
      await this.jobSearchService.getUserMatchContext(userId);

    return {
      data: applications.map((a) =>
        this.toDto(
          a,
          a.jobListing,
          a.jobListing
            ? this.jobSearchService.computeMatchScoreForListing(
                a.jobListing,
                matchContext,
              )
            : null,
        ),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasPrevious: page > 1,
        hasNext: page < Math.ceil(total / limit),
      },
    };
  }

  async findApplication(
    id: string,
    userId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: ['jobListing'],
    });
    this.assertOwnership(application, id, userId);
    return this.toDtoForUser(application, application.jobListing, userId);
  }

  async updateApplication(
    id: string,
    userId: string,
    dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: ['jobListing'],
    });
    this.assertOwnership(application, id, userId);

    if (dto.status) application.status = dto.status;
    if (dto.notes !== undefined) application.notes = dto.notes;

    const saved = await this.applicationRepository.save(application);
    return this.toDtoForUser(saved, application.jobListing, userId);
  }

  async deleteApplication(id: string, userId: string): Promise<void> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });
    this.assertOwnership(application, id, userId);
    await this.applicationRepository.remove(application);
  }

  // ── Document Generation ───────────────────────────────────────────────────

  async generateDocuments(
    id: string,
    userId: string,
    user: User,
  ): Promise<{
    resume: Record<string, any>;
    coverLetter: Record<string, any>;
  }> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: ['jobListing'],
    });
    this.assertOwnership(application, id, userId);

    const costAccumulator = this.aiCostTrackingService.createAccumulator();
    const result = await this.jobDocumentGenerator.generateDocuments(
      application,
      application.jobListing,
      userId,
      costAccumulator,
    );

    this.aiCostTrackingService.recordFromAccumulator(
      userId,
      'documents_generated',
      'job-application',
      costAccumulator,
      { applicationId: id },
    );

    this.dashboardEventService.emitFeatureUsed(
      userId,
      'job-application',
      'documents_generated',
    );

    return result;
  }

  async getDocuments(
    id: string,
    userId: string,
  ): Promise<{
    resume: Record<string, any> | null;
    coverLetter: Record<string, any> | null;
    hasDocuments: boolean;
  }> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });
    this.assertOwnership(application, id, userId);

    return {
      resume: application.generatedResumeContent ?? null,
      coverLetter: application.generatedCoverLetterContent ?? null,
      hasDocuments: !!(
        application.generatedResumeContent &&
        application.generatedCoverLetterContent
      ),
    };
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  async applyToJob(
    id: string,
    userId: string,
    user: User,
  ): Promise<ApplyJobResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: ['jobListing'],
    });
    this.assertOwnership(application, id, userId);

    const { result, atsApplicationId, atsSubmittedAt } =
      await this.jobApplyService.apply({
        application,
        listing: application.jobListing,
        user,
      });

    application.status = JobApplicationStatus.Applied;
    application.appliedAt = new Date();
    if (atsApplicationId) application.atsApplicationId = atsApplicationId;
    if (atsSubmittedAt) application.atsSubmittedAt = atsSubmittedAt;
    await this.applicationRepository.save(application);

    this.dashboardEventService.emitFeatureUsed(
      userId,
      'job-application',
      'applied',
    );

    return result;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private assertOwnership(
    application: JobApplication | null,
    id: string,
    userId: string,
  ): asserts application is JobApplication {
    if (!application)
      throw new NotFoundException(`Application ${id} not found`);
    if (application.userId !== userId)
      throw new ForbiddenException('Access denied');
  }

  private async toDtoForUser(
    application: JobApplication,
    listing: JobListing,
    userId: string,
  ): Promise<ApplicationResponseDto> {
    const matchContext = listing
      ? await this.jobSearchService.getUserMatchContext(userId)
      : null;
    const matchScore = listing
      ? this.jobSearchService.computeMatchScoreForListing(listing, matchContext)
      : null;

    return this.toDto(application, listing, matchScore);
  }

  private toDto(
    application: JobApplication,
    listing: JobListing,
    matchScore: number | null = null,
  ): ApplicationResponseDto {
    return {
      id: application.id,
      userId: application.userId,
      jobListingId: application.jobListingId,
      jobListing: listing
        ? {
            id: listing.id,
            externalId: listing.externalId ?? null,
            title: listing.title,
            company: listing.company ?? null,
            location: listing.location ?? null,
            description: listing.description ?? null,
            salary: listing.salary ?? null,
            jobType: listing.jobType ?? null,
            skills: listing.skills ?? null,
            experienceLevel: listing.experienceLevel ?? null,
            source: listing.source ?? null,
            sourceUrl: listing.sourceUrl ?? null,
            applicationUrl: listing.applicationUrl ?? null,
            postedDate: listing.postedDate ?? null,
            matchScore,
            isRemote: listing.isRemote,
            country: listing.country ?? null,
            atsType: listing.atsType ?? null,
            createdAt: listing.createdAt,
          }
        : null,
      status: application.status,
      appliedAt: application.appliedAt ?? null,
      customCvId: application.customCvId ?? null,
      customCoverLetterId: application.customCoverLetterId ?? null,
      notes: application.notes ?? null,
      atsApplicationId: application.atsApplicationId ?? null,
      atsSubmittedAt: application.atsSubmittedAt ?? null,
      hasGeneratedDocuments: !!(
        application.generatedResumeContent &&
        application.generatedCoverLetterContent
      ),
      generatedResumeContent: application.generatedResumeContent ?? null,
      generatedCoverLetterContent:
        application.generatedCoverLetterContent ?? null,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}
