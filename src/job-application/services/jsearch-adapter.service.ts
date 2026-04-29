import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SearchJobsDto, JobCountry, JobType } from '../dto/search-jobs.dto';
import { NormalizedJobListing } from './job-search.service';

const JOB_TYPE_MAP: Partial<Record<JobType, string>> = {
  [JobType.FullTime]: 'FULLTIME',
  [JobType.PartTime]: 'PARTTIME',
  [JobType.Contract]: 'CONTRACTOR',
  [JobType.Internship]: 'INTERN',
};

@Injectable()
export class JSearchAdapterService {
  private readonly logger = new Logger(JSearchAdapterService.name);
  private readonly baseUrl = 'https://jsearch.p.rapidapi.com/search';

  constructor(private configService: ConfigService) {}

  async search(filters: SearchJobsDto): Promise<NormalizedJobListing[]> {
    const apiKey = this.configService.get<string>('JSEARCH_RAPIDAPI_KEY');
    if (!apiKey) return [];

    const country = filters.country ?? JobCountry.Nigeria;
    const locationStr = filters.location
      ? `${filters.location}, ${country === 'global' ? '' : country}`
      : country === 'global'
        ? 'Remote'
        : country === 'NG'
          ? 'Nigeria'
          : country;

    const query = [filters.q || 'jobs', 'in', locationStr].join(' ');

    try {
      const { data } = await axios.get(this.baseUrl, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
        params: {
          query,
          page: filters.page ?? 1,
          num_pages: 1,
          ...(filters.jobType && { employment_types: JOB_TYPE_MAP[filters.jobType] }),
          ...(filters.remote && { remote_jobs_only: 'true' }),
          date_posted: 'month',
        },
        timeout: 15000,
      });

      return (data.data ?? []).map((job: any) => this.normalise(job));
    } catch (err) {
      this.logger.warn(`JSearch search failed: ${err.message}`);
      return [];
    }
  }

  private normalise(job: any): NormalizedJobListing {
    const applyOpt = job.apply_options?.[0];
    const url = applyOpt?.apply_link ?? job.job_apply_link ?? null;
    return {
      externalId: job.job_id ?? null,
      title: job.job_title ?? 'Untitled',
      company: job.employer_name ?? null,
      location: job.job_city
        ? `${job.job_city}${job.job_country ? ', ' + job.job_country : ''}`
        : job.job_country ?? null,
      description: job.job_description ?? null,
      salary:
        job.job_min_salary && job.job_max_salary
          ? `${job.job_salary_currency ?? ''}${job.job_min_salary}–${job.job_max_salary} ${job.job_salary_period ?? ''}`
          : null,
      jobType: job.job_employment_type ?? null,
      skills: job.job_required_skills ?? [],
      experienceLevel: job.job_required_experience?.required_experience_in_months
        ? job.job_required_experience.required_experience_in_months < 24
          ? 'entry'
          : job.job_required_experience.required_experience_in_months < 60
            ? 'mid'
            : 'senior'
        : null,
      source: 'jsearch',
      sourceUrl: url,
      applicationUrl: url,
      postedDate: job.job_posted_at_datetime_utc
        ? new Date(job.job_posted_at_datetime_utc)
        : null,
      isRemote: job.job_is_remote ?? false,
      country: job.job_country ?? null,
      atsType: this.detectAts(url),
      atsBoardToken: this.extractBoardToken(url),
      atsJobId: this.extractAtsJobId(url),
      rawData: job,
    };
  }

  private detectAts(url: string | null): string | null {
    if (!url) return null;
    if (url.includes('boards.greenhouse.io')) return 'greenhouse';
    if (url.includes('jobs.lever.co')) return 'lever';
    return null;
  }

  private extractBoardToken(url: string | null): string | null {
    if (!url || !url.includes('boards.greenhouse.io')) return null;
    const match = url.match(/boards\.greenhouse\.io\/([^/?#]+)/);
    return match?.[1] ?? null;
  }

  private extractAtsJobId(url: string | null): string | null {
    if (!url) return null;
    const ghMatch = url.match(/boards\.greenhouse\.io\/[^/]+\/jobs\/(\d+)/);
    if (ghMatch) return ghMatch[1];
    const leverMatch = url.match(/jobs\.lever\.co\/[^/]+\/([a-f0-9-]+)/);
    if (leverMatch) return leverMatch[1];
    return null;
  }
}
