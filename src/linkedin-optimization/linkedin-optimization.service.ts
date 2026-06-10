import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LinkedInProfile } from './entities/linkedin-profile.entity';
import { LinkedInContentService } from './services/linkedin-content.service';
import { ResumeData } from '../resume-builder/entities/resume-data.entity';
import { Resume } from '../resume-builder/entities/resume.entity';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import { AiCostTrackingService } from '../admin/services/ai-cost-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';

@Injectable()
export class LinkedInOptimizationService {
  private readonly logger = new Logger(LinkedInOptimizationService.name);

  constructor(
    @InjectRepository(LinkedInProfile)
    private linkedInProfileRepository: Repository<LinkedInProfile>,
    @InjectRepository(Resume)
    private resumeRepository: Repository<Resume>,
    @InjectRepository(ResumeData)
    private resumeDataRepository: Repository<ResumeData>,
    private linkedInContentService: LinkedInContentService,
    private professionalProfileService: ProfessionalProfileService,
    private aiCostTrackingService: AiCostTrackingService,
    private dashboardEventService: DashboardEventService,
  ) {}

  /**
   * Generate LinkedIn profile from user's resume data
   */
  async generateProfile(userId: string): Promise<LinkedInProfile> {
    try {
      // Get user's latest resume data
      const resumeData = await this.getLatestResumeData(userId);

      const costAccumulator = this.aiCostTrackingService.createAccumulator();
      const sections = await this.linkedInContentService.generateLinkedInProfile(
        resumeData,
        costAccumulator,
      );

      // Get or create LinkedIn profile
      let profile = await this.linkedInProfileRepository.findOne({
        where: { userId },
      });

      if (!profile) {
        profile = this.linkedInProfileRepository.create({
          userId,
          ...sections,
        });
      } else {
        Object.assign(profile, sections);
      }

      const savedProfile = await this.linkedInProfileRepository.save(profile);

      // Mark linkedin section as complete in professional profile
      try {
        await this.professionalProfileService.markSectionComplete(userId, 'linkedin');
      } catch (err) {
        this.logger.warn('Could not mark linkedin section as complete', err);
      }

      this.aiCostTrackingService.recordFromAccumulator(
        userId,
        'profile_generated',
        'linkedin-optimization',
        costAccumulator,
      );
      this.dashboardEventService.emitFeatureUsed(userId, 'linkedin-optimization', 'profile_generated');

      return savedProfile;
    } catch (error) {
      this.logger.error('Error generating LinkedIn profile', error);
      throw error;
    }
  }

  /**
   * Get LinkedIn profile for user
   */
  async getProfile(userId: string): Promise<LinkedInProfile | null> {
    return await this.linkedInProfileRepository.findOne({
      where: { userId },
    });
  }

  async replaceProfile(
    userId: string,
    payload: Partial<LinkedInProfile>,
  ): Promise<LinkedInProfile> {
    let profile = await this.linkedInProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      profile = this.linkedInProfileRepository.create({ userId });
    }
    Object.assign(profile, payload);
    return await this.linkedInProfileRepository.save(profile);
  }

  async patchProfile(
    userId: string,
    payload: Partial<LinkedInProfile>,
  ): Promise<LinkedInProfile> {
    const profile = await this.linkedInProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('LinkedIn profile not found. Please generate it first.');
    }
    Object.assign(profile, payload);
    return await this.linkedInProfileRepository.save(profile);
  }

  async deleteProfile(userId: string): Promise<void> {
    const profile = await this.linkedInProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('LinkedIn profile not found.');
    }
    await this.linkedInProfileRepository.remove(profile);
  }

  /**
   * Update specific section of LinkedIn profile
   */
  async updateSection(
    userId: string,
    section: keyof LinkedInProfile,
    data: any,
  ): Promise<LinkedInProfile> {
    const profile = await this.linkedInProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('LinkedIn profile not found. Please generate it first.');
    }

    (profile as any)[section] = data;
    return await this.linkedInProfileRepository.save(profile);
  }

  /**
   * Get latest resume data for user
   */
  private async getLatestResumeData(userId: string): Promise<ResumeData | null> {
    // Find latest resume for user
    const latestResume = await this.resumeRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (!latestResume) {
      return null;
    }

    // Get resume data
    const resumeData = await this.resumeDataRepository.findOne({
      where: { resumeId: latestResume.id },
    });

    return resumeData;
  }
}

