import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SearchJobsDto, JobCountry } from '../dto/search-jobs.dto';
import { NormalizedJobListing } from './job-search.service';

@Injectable()
export class RemotiveAdapterService {
  private readonly logger = new Logger(RemotiveAdapterService.name);
  private readonly baseUrl = 'https://remotive.com/api/remote-jobs';

  async search(filters: SearchJobsDto): Promise<NormalizedJobListing[]> {
    try {
      const { data } = await axios.get(this.baseUrl, {
        params: {
          search: filters.q ?? '',
          limit: 20,
        },
        timeout: 8000,
      });

      return (data.jobs ?? []).map((job: any) => this.normalise(job));
    } catch (err) {
      this.logger.warn(`Remotive search failed: ${err.message}`);
      return [];
    }
  }

  private normalise(job: any): NormalizedJobListing {
    return {
      externalId: job.id?.toString() ?? null,
      title: job.title ?? 'Untitled',
      company: job.company_name ?? null,
      location: job.candidate_required_location ?? 'Remote',
      description: job.description ?? null,
      salary: job.salary ?? null,
      jobType: job.job_type ?? null,
      skills: job.tags ?? [],
      experienceLevel: null,
      source: 'remotive',
      sourceUrl: job.url ?? null,
      applicationUrl: job.url ?? null,
      postedDate: job.publication_date ? new Date(job.publication_date) : null,
      isRemote: true,
      country: null,
      atsType: null,
      atsBoardToken: null,
      atsJobId: null,
      rawData: job,
    };
  }
}
