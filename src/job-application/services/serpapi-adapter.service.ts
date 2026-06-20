import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SearchJobsDto, JobCountry } from '../dto/search-jobs.dto';
import { NormalizedJobListing } from './job-search.service';

const COUNTRY_LOCALE: Record<string, string> = {
  NG: 'ng',
  GH: 'gh',
  KE: 'ke',
  ZA: 'za',
  global: 'us',
};

@Injectable()
export class SerpApiAdapterService {
  private readonly logger = new Logger(SerpApiAdapterService.name);
  private readonly baseUrl = 'https://serpapi.com/search.json';

  constructor(private configService: ConfigService) {}

  async search(filters: SearchJobsDto): Promise<NormalizedJobListing[]> {
    const apiKey = this.configService.get<string>('SERPAPI_API_KEY');
    if (!apiKey) return [];

    const country = filters.country ?? JobCountry.Nigeria;
    const gl = COUNTRY_LOCALE[country] ?? 'ng';
    const locationStr = filters.location
      ? filters.location
      : country === 'global'
        ? 'Remote'
        : country === 'NG'
          ? 'Nigeria'
          : country;

    const query = [
      filters.q,
      filters.remote ? 'remote' : null,
      filters.jobType,
      filters.experienceLevel,
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const { data } = await axios.get(this.baseUrl, {
        params: {
          engine: 'google_jobs',
          q: query || 'jobs',
          location: locationStr,
          gl,
          hl: 'en',
          api_key: apiKey,
          start: ((filters.page ?? 1) - 1) * 10,
        },
        timeout: 10000,
      });

      return (data.jobs_results ?? []).map((job: any) => this.normalise(job));
    } catch (err) {
      this.logger.warn(`SerpApi search failed: ${err.message}`);
      return [];
    }
  }

  private normalise(job: any): NormalizedJobListing {
    const applyOption = job.apply_options?.[0];
    return {
      externalId: job.job_id ?? null,
      title: job.title ?? 'Untitled',
      company: job.company_name ?? null,
      location: job.location ?? null,
      description: job.description ?? null,
      salary: job.salary ?? job.detected_extensions?.salary_range ?? null,
      jobType: job.detected_extensions?.schedule_type ?? null,
      skills: [],
      experienceLevel: null,
      source: 'serpapi',
      sourceUrl: applyOption?.link ?? job.share_link ?? null,
      applicationUrl: applyOption?.link ?? null,
      postedDate: job.detected_extensions?.posted_at
        ? this.parsePostedAt(job.detected_extensions.posted_at)
        : null,
      isRemote:
        (job.location ?? '').toLowerCase().includes('remote') ||
        (job.detected_extensions?.work_from_home ?? false),
      country: null,
      atsType: null,
      atsBoardToken: null,
      atsJobId: null,
      rawData: job,
    };
  }

  private parsePostedAt(str: string): Date | null {
    try {
      const now = new Date();
      const lower = str.toLowerCase();
      if (lower.includes('hour') || lower.includes('just')) return now;
      const daysMatch = lower.match(/(\d+)\s*day/);
      if (daysMatch) {
        now.setDate(now.getDate() - parseInt(daysMatch[1]));
        return now;
      }
      return null;
    } catch {
      return null;
    }
  }
}
