import { Injectable } from '@nestjs/common';

@Injectable()
export class JobMatchingService {
  /**
   * Simple keyword-overlap match score (0–100) between user skills/resume text and job listing.
   */
  computeMatchScore(
    userSkills: string[] | string | null | undefined,
    userResumeText: string,
    jobSkills: string[] | null | undefined,
    jobDescription: string | null | undefined,
  ): number {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

    // Profiles in the wild store skills as an array, a comma-separated string,
    // or nothing at all. Assuming an array here crashed the whole applications
    // list with "userSkills.flatMap is not a function".
    const skillList = Array.isArray(userSkills)
      ? userSkills.filter((s): s is string => typeof s === 'string')
      : typeof userSkills === 'string'
        ? userSkills.split(',')
        : [];

    const userTokens = new Set([
      ...skillList.flatMap((s) => normalize(s)),
      ...normalize(userResumeText || ''),
    ]);

    const jobTokens = [
      ...(jobSkills || []).flatMap((s) => normalize(s)),
      ...normalize(jobDescription || ''),
    ];

    if (jobTokens.length === 0 || userTokens.size === 0) return 0;

    const uniqueJob = [...new Set(jobTokens)];
    const matches = uniqueJob.filter((t) => userTokens.has(t)).length;
    const score = Math.round((matches / uniqueJob.length) * 100);
    return Math.min(100, Math.max(0, score));
  }
}
