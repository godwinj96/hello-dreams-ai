import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { JobApplication, JobApplicationStatus } from '../entities/job-application.entity';
import { JobListing } from '../entities/job-listing.entity';
import { ApplyJobResponseDto } from '../dto/apply-job.dto';
import { User } from '../../users/entities/user.entity';

export interface ApplyContext {
  application: JobApplication;
  listing: JobListing;
  user: User;
}

@Injectable()
export class JobApplyService {
  private readonly logger = new Logger(JobApplyService.name);

  async apply(ctx: ApplyContext): Promise<{ result: ApplyJobResponseDto; atsApplicationId?: string; atsSubmittedAt?: Date }> {
    const { listing } = ctx;

    if (listing.atsType === 'greenhouse' && listing.atsBoardToken && listing.atsJobId) {
      return this.applyViaGreenhouse(ctx);
    }

    if (listing.atsType === 'lever' && listing.atsJobId) {
      return this.applyViaLever(ctx);
    }

    // Default: redirect
    const applyUrl = listing.applicationUrl ?? listing.sourceUrl ?? null;
    if (!applyUrl) {
      throw new BadRequestException('No application URL found for this job listing');
    }

    return {
      result: {
        method: 'redirect',
        applyUrl,
        status: JobApplicationStatus.Applied,
      },
    };
  }

  private async applyViaGreenhouse(ctx: ApplyContext): Promise<{ result: ApplyJobResponseDto; atsApplicationId?: string; atsSubmittedAt?: Date }> {
    const { application, listing, user } = ctx;

    const nameParts = user.name?.split(' ') ?? [];
    const firstName = nameParts[0] ?? user.email;
    const lastName = nameParts.slice(1).join(' ') || '-';

    const payload: Record<string, any> = {
      first_name: firstName,
      last_name: lastName,
      email: user.email,
    };

    // Attach cover letter as text if generated
    if (application.generatedCoverLetterContent) {
      const cl = application.generatedCoverLetterContent;
      const body = cl.body ?? cl.content ?? cl.text ?? JSON.stringify(cl);
      payload.cover_letter_text = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${listing.atsBoardToken}/jobs/${listing.atsJobId}`;
      const { data } = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      const atsApplicationId = data?.id?.toString() ?? undefined;
      return {
        result: {
          method: 'api',
          atsApplicationId,
          status: JobApplicationStatus.Applied,
        },
        atsApplicationId,
        atsSubmittedAt: new Date(),
      };
    } catch (err) {
      this.logger.warn(`Greenhouse apply failed (${listing.atsBoardToken}/${listing.atsJobId}): ${err.message}. Falling back to redirect.`);
      const applyUrl = listing.applicationUrl ?? listing.sourceUrl ?? '';
      return {
        result: {
          method: 'redirect',
          applyUrl,
          status: JobApplicationStatus.Applied,
        },
      };
    }
  }

  private async applyViaLever(ctx: ApplyContext): Promise<{ result: ApplyJobResponseDto; atsApplicationId?: string; atsSubmittedAt?: Date }> {
    const { application, listing, user } = ctx;

    // Extract company and API key from sourceUrl: https://jobs.lever.co/{company}/{jobId}?lever-origin=...
    const leverMatch = listing.sourceUrl?.match(/jobs\.lever\.co\/([^/]+)\/([a-f0-9-]+)/);
    const company = leverMatch?.[1];
    if (!company || !listing.atsJobId) {
      return this.fallbackRedirect(listing);
    }

    // Lever requires a posting-specific API key — fetch it from the posting first
    let leverKey: string | null = null;
    try {
      const postingRes = await axios.get(
        `https://api.lever.co/v0/postings/${company}/${listing.atsJobId}`,
        { timeout: 8000 },
      );
      leverKey = postingRes.data?.applyUrl?.match(/key=([^&]+)/)?.[1] ?? null;
    } catch {
      return this.fallbackRedirect(listing);
    }

    if (!leverKey) return this.fallbackRedirect(listing);

    const payload: Record<string, any> = {
      name: user.name ?? user.email,
      email: user.email,
      org: '',
      comments: '',
    };

    if (application.generatedCoverLetterContent) {
      const cl = application.generatedCoverLetterContent;
      const body = cl.body ?? cl.content ?? cl.text ?? JSON.stringify(cl);
      payload.comments = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const { data } = await axios.post(
        `https://api.lever.co/v0/postings/${company}/${listing.atsJobId}?key=${leverKey}`,
        payload,
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );

      const atsApplicationId = data?.applicationId ?? data?.id ?? undefined;
      return {
        result: {
          method: 'api',
          atsApplicationId,
          status: JobApplicationStatus.Applied,
        },
        atsApplicationId,
        atsSubmittedAt: new Date(),
      };
    } catch (err) {
      this.logger.warn(`Lever apply failed: ${err.message}. Falling back to redirect.`);
      return this.fallbackRedirect(listing);
    }
  }

  private fallbackRedirect(listing: JobListing): { result: ApplyJobResponseDto } {
    return {
      result: {
        method: 'redirect',
        applyUrl: listing.applicationUrl ?? listing.sourceUrl ?? '',
        status: JobApplicationStatus.Applied,
      },
    };
  }
}
