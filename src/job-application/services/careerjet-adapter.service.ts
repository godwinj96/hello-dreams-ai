import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SearchJobsDto, JobCountry } from '../dto/search-jobs.dto';
import { NormalizedJobListing } from './job-search.service';

const COUNTRY_LOCALE: Record<string, string> = {
  NG: 'en_NG',
  GH: 'en_GH',
  KE: 'en_KE',
  ZA: 'en_ZA',
  global: 'en_GB',
};

@Injectable()
export class CareerjetAdapterService {
  private readonly logger = new Logger(CareerjetAdapterService.name);
  private readonly baseUrl = 'https://public.api.careerjet.net/v4/query';

  constructor(private configService: ConfigService) {}

  async search(filters: SearchJobsDto): Promise<NormalizedJobListing[]> {
    const apiKey = this.configService.get<string>('CAREERJET_API_KEY');
    if (!apiKey) return [];

    const country = filters.country ?? JobCountry.Nigeria;
    const locale = COUNTRY_LOCALE[country] ?? 'en_NG';

    try {
      const { data } = await axios.get(this.baseUrl, {
        params: {
          keywords: filters.q || 'jobs',
          location: filters.location ?? '',
          locale,
          affid: apiKey,
          user_ip: '127.0.0.1',
          url: 'https://hellodreams.ai',
          user_agent: 'HelloDreamsAI/1.0',
          pagesize: filters.limit ?? 20,
          page: filters.page ?? 1,
          sort: 'date',
        },
        timeout: 10000,
      });

      return (data.jobs ?? []).map((job: any) => this.normalise(job));
    } catch (err) {
      this.logger.warn(`Careerjet search failed: ${err.message}`);
      return [];
    }
  }

  private normalise(job: any): NormalizedJobListing {
    return {
      externalId: job.id?.toString() ?? null,
      title: job.title ?? 'Untitled',
      company: job.company ?? null,
      location: job.locations ?? null,
      description: job.description ?? null,
      salary: job.salary ?? null,
      jobType: null,
      skills: [],
      experienceLevel: null,
      source: 'careerjet',
      sourceUrl: job.url ?? null,
      applicationUrl: job.url ?? null,
      postedDate: job.date ? new Date(job.date) : null,
      isRemote:
        (job.title ?? '').toLowerCase().includes('remote') ||
        (job.locations ?? '').toLowerCase().includes('remote'),
      country: null,
      atsType: this.detectAts(job.url),
      atsBoardToken: this.extractBoardToken(job.url),
      atsJobId: this.extractAtsJobId(job.url),
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
    const match = url.match(/boards\.greenhouse\.io\/([^/]+)/);
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
