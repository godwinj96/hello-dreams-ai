import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JobListing } from '../entities/job-listing.entity';
import { SearchJobsDto } from '../dto/search-jobs.dto';
import { JobListingResponseDto } from '../dto/job-listing-response.dto';
import { SerpApiAdapterService } from './serpapi-adapter.service';
import { CareerjetAdapterService } from './careerjet-adapter.service';
import { JSearchAdapterService } from './jsearch-adapter.service';
import { RemotiveAdapterService } from './remotive-adapter.service';
import { JobMatchingService } from './job-matching.service';
import { Resume } from '../../resume-builder/entities/resume.entity';

export interface NormalizedJobListing {
  externalId: string | null;
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  salary: string | null;
  jobType: string | null;
  skills: string[];
  experienceLevel: string | null;
  source: string;
  sourceUrl: string | null;
  applicationUrl: string | null;
  postedDate: Date | null;
  isRemote: boolean;
  country: string | null;
  atsType: string | null;
  atsBoardToken: string | null;
  atsJobId: string | null;
  rawData: Record<string, any>;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface UserMatchContext {
  userSkills: string[];
  resumeText: string;
}

@Injectable()
export class JobSearchService {
  private readonly logger = new Logger(JobSearchService.name);

  constructor(
    @InjectRepository(JobListing)
    private listingRepository: Repository<JobListing>,
    @InjectRepository(Resume)
    private resumeRepository: Repository<Resume>,
    private serpApi: SerpApiAdapterService,
    private careerjet: CareerjetAdapterService,
    private jSearch: JSearchAdapterService,
    private remotive: RemotiveAdapterService,
    private jobMatchingService: JobMatchingService,
  ) {}

  async search(
    filters: SearchJobsDto,
    userId?: string,
  ): Promise<{ data: JobListingResponseDto[]; meta: any }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    // Fan out to all sources in parallel; failures are silently skipped
    const [serpRes, careerjetRes, jsearchRes, remotiveRes] =
      await Promise.allSettled([
        this.serpApi.search(filters),
        this.careerjet.search(filters),
        this.jSearch.search(filters),
        this.remotive.search(filters),
      ]);

    const allRaw: NormalizedJobListing[] = [
      ...(serpRes.status === 'fulfilled' ? serpRes.value : []),
      ...(careerjetRes.status === 'fulfilled' ? careerjetRes.value : []),
      ...(jsearchRes.status === 'fulfilled' ? jsearchRes.value : []),
      ...(remotiveRes.status === 'fulfilled' ? remotiveRes.value : []),
    ];

    // Deduplicate on normalised sourceUrl
    const seen = new Set<string>();
    const unique = allRaw.filter((job) => {
      const key = this.dedupeKey(job);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Upsert into DB for caching and later reference
    let listings = await this.upsertListings(unique);

    const matchContext = userId
      ? await this.getUserMatchContext(userId)
      : null;

    const scoredListings = listings.map((listing) => ({
      listing,
      matchScore: this.computeMatchScoreForListing(listing, matchContext),
    }));

    if (userId) {
      scoredListings.sort(
        (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0),
      );
    }

    // Apply in-memory filters not handled by all adapters
    let filtered = scoredListings;
    if (filters.remote) {
      filtered = filtered.filter(({ listing }) => listing.isRemote);
    }
    if (filters.experienceLevel) {
      filtered = filtered.filter(
        ({ listing }) =>
          !listing.experienceLevel ||
          listing.experienceLevel === filters.experienceLevel,
      );
    }

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * limit, page * limit);

    return {
      data: paged.map(({ listing, matchScore }) =>
        this.toDto(listing, matchScore),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasPrevious: page > 1,
        hasNext: page < Math.ceil(total / limit),
        sourcesConfigured: {
          serpapi: Boolean(process.env.SERPAPI_API_KEY),
          careerjet: Boolean(process.env.CAREERJET_API_KEY),
          jsearch: Boolean(process.env.JSEARCH_RAPIDAPI_KEY),
          remotive: true,
        },
      },
    };
  }

  async findById(
    id: string,
    userId?: string,
  ): Promise<JobListingResponseDto | null> {
    const listing = await this.listingRepository.findOne({ where: { id } });
    if (!listing) return null;

    const matchContext = userId
      ? await this.getUserMatchContext(userId)
      : null;
    const matchScore = this.computeMatchScoreForListing(listing, matchContext);

    return this.toDto(listing, matchScore);
  }

  async getUserMatchContext(
    userId: string,
  ): Promise<UserMatchContext | null> {
    const resumes = await this.resumeRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    const resume = resumes[0];
    if (!resume) return null;

    const resumeContent = resume.content as Record<string, any> | undefined;
    return {
      userSkills: resumeContent?.skills ?? [],
      resumeText: JSON.stringify(resumeContent ?? {}),
    };
  }

  computeMatchScoreForListing(
    listing: JobListing,
    matchContext: UserMatchContext | null,
  ): number | null {
    if (!matchContext) return null;

    return this.jobMatchingService.computeMatchScore(
      matchContext.userSkills,
      matchContext.resumeText,
      listing.skills,
      listing.description,
    );
  }

  private async upsertListings(
    jobs: NormalizedJobListing[],
  ): Promise<JobListing[]> {
    const results: JobListing[] = [];
    const now = new Date();

    for (const job of jobs) {
      try {
        const key = this.dedupeKey(job);
        // Try to find existing by sourceUrl match
        let existing: JobListing | null = null;
        if (job.sourceUrl) {
          existing = await this.listingRepository.findOne({
            where: { sourceUrl: job.sourceUrl },
          });
        }
        if (!existing && job.externalId && job.source) {
          existing = await this.listingRepository.findOne({
            where: { externalId: job.externalId, source: job.source },
          });
        }

        if (existing) {
          // Only refresh if cache is stale
          const cacheAge = now.getTime() - (existing.cachedAt?.getTime() ?? 0);
          if (cacheAge > CACHE_TTL_MS) {
            Object.assign(existing, this.toEntityFields(job), {
              cachedAt: now,
            });
            results.push(await this.listingRepository.save(existing));
          } else {
            results.push(existing);
          }
        } else {
          const listing = this.listingRepository.create({
            ...this.toEntityFields(job),
            cachedAt: now,
          });
          results.push(await this.listingRepository.save(listing));
        }
      } catch (err) {
        this.logger.warn(`Failed to upsert listing: ${err.message}`);
      }
    }

    return results;
  }

  private dedupeKey(job: NormalizedJobListing): string {
    if (job.sourceUrl) return job.sourceUrl;
    return `${job.source}::${job.externalId}`;
  }

  private toEntityFields(job: NormalizedJobListing): Partial<JobListing> {
    return {
      externalId: job.externalId ?? undefined,
      title: job.title,
      company: job.company ?? undefined,
      location: job.location ?? undefined,
      description: job.description ?? undefined,
      salary: job.salary ?? undefined,
      jobType: job.jobType ?? undefined,
      skills: job.skills.length ? job.skills : undefined,
      experienceLevel: job.experienceLevel ?? undefined,
      source: job.source,
      sourceUrl: job.sourceUrl ?? undefined,
      applicationUrl: job.applicationUrl ?? undefined,
      postedDate: job.postedDate ?? undefined,
      isRemote: job.isRemote,
      country: job.country ?? undefined,
      atsType: job.atsType ?? undefined,
      atsBoardToken: job.atsBoardToken ?? undefined,
      atsJobId: job.atsJobId ?? undefined,
      rawData: job.rawData,
    };
  }

  private toDto(
    listing: JobListing,
    matchScore: number | null = null,
  ): JobListingResponseDto {
    return {
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
    };
  }
}
