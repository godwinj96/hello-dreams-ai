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

@Injectable()
export class JobSearchService {
  private readonly logger = new Logger(JobSearchService.name);

  constructor(
    @InjectRepository(JobListing)
    private listingRepository: Repository<JobListing>,
    private serpApi: SerpApiAdapterService,
    private careerjet: CareerjetAdapterService,
    private jSearch: JSearchAdapterService,
    private remotive: RemotiveAdapterService,
  ) {}

  async search(
    filters: SearchJobsDto,
  ): Promise<{ data: JobListingResponseDto[]; meta: any }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    // Fan out to all sources in parallel; failures are silently skipped
    const [serpRes, careerjetRes, jsearchRes, remotiveRes] = await Promise.allSettled([
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
    const listings = await this.upsertListings(unique);

    // Apply in-memory filters not handled by all adapters
    let filtered = listings;
    if (filters.remote) {
      filtered = filtered.filter((l) => l.isRemote);
    }
    if (filters.experienceLevel) {
      filtered = filtered.filter(
        (l) => !l.experienceLevel || l.experienceLevel === filters.experienceLevel,
      );
    }

    const total = filtered.length;
    const paged = filtered.slice((page - 1) * limit, page * limit);

    return {
      data: paged.map((l) => this.toDto(l)),
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

  async findById(id: string): Promise<JobListingResponseDto | null> {
    const listing = await this.listingRepository.findOne({ where: { id } });
    return listing ? this.toDto(listing) : null;
  }

  private async upsertListings(jobs: NormalizedJobListing[]): Promise<JobListing[]> {
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
            Object.assign(existing, this.toEntityFields(job), { cachedAt: now });
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

  private toDto(listing: JobListing): JobListingResponseDto {
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
      matchScore: listing.matchScore ?? null,
      isRemote: listing.isRemote,
      country: listing.country ?? null,
      atsType: listing.atsType ?? null,
      createdAt: listing.createdAt,
    };
  }
}
