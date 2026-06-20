import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfessionalProfile } from './entities/professional-profile.entity';

@Injectable()
export class ProfessionalProfileService {
  private readonly logger = new Logger(ProfessionalProfileService.name);

  constructor(
    @InjectRepository(ProfessionalProfile)
    private profileRepository: Repository<ProfessionalProfile>,
  ) {}

  async getProfile(userId: string): Promise<ProfessionalProfile> {
    let profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      // Create profile if it doesn't exist
      profile = this.profileRepository.create({
        userId,
        careerGoals: {},
        persona: {},
        extractedData: {},
        completedSections: {},
      });
      profile = await this.profileRepository.save(profile);
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    data: Partial<ProfessionalProfile>,
  ): Promise<ProfessionalProfile> {
    let profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = this.profileRepository.create({
        userId,
        ...data,
      });
    } else {
      Object.assign(profile, data);
    }

    return await this.profileRepository.save(profile);
  }

  async updateCareerGoals(
    userId: string,
    careerGoals: Partial<ProfessionalProfile['careerGoals']>,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);

    profile.careerGoals = {
      ...profile.careerGoals,
      ...careerGoals,
    };

    if (!profile.completedSections) {
      profile.completedSections = {};
    }
    profile.completedSections.careerProfile = true;

    return await this.profileRepository.save(profile);
  }

  async updatePersona(
    userId: string,
    persona: Partial<ProfessionalProfile['persona']>,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);

    profile.persona = {
      ...profile.persona,
      ...persona,
    };

    if (!profile.completedSections) {
      profile.completedSections = {};
    }
    profile.completedSections.persona = true;

    return await this.profileRepository.save(profile);
  }

  async updateExtractedData(
    userId: string,
    extractedData: Partial<ProfessionalProfile['extractedData']>,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);

    profile.extractedData = {
      ...profile.extractedData,
      ...extractedData,
    };

    return await this.profileRepository.save(profile);
  }

  async updateBasicInfo(
    userId: string,
    basicInfo: Partial<ProfessionalProfile['basicInfo']>,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);

    profile.basicInfo = {
      ...profile.basicInfo,
      ...basicInfo,
    };

    return await this.profileRepository.save(profile);
  }

  async updateTargetJob(
    userId: string,
    targetJob: Partial<ProfessionalProfile['targetJob']>,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);

    profile.targetJob = {
      ...profile.targetJob,
      ...targetJob,
    };

    return await this.profileRepository.save(profile);
  }

  async updateCvMetadata(
    userId: string,
    cvMetadata: Partial<ProfessionalProfile['cvMetadata']>,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);

    profile.cvMetadata = {
      ...profile.cvMetadata,
      ...cvMetadata,
    };

    return await this.profileRepository.save(profile);
  }

  async updatePersonaData(
    userId: string,
    personaData: Partial<ProfessionalProfile['personaData']>,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);

    profile.personaData = {
      ...profile.personaData,
      ...personaData,
    };

    return await this.profileRepository.save(profile);
  }

  async setInteractionMode(
    userId: string,
    mode: 'text' | 'voice',
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);
    profile.interactionMode = mode;
    return await this.profileRepository.save(profile);
  }

  async setCvUploadUrl(
    userId: string,
    url: string,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);
    profile.cvUploadUrl = url;
    return await this.profileRepository.save(profile);
  }

  async getProfileForGeneration(userId: string): Promise<{
    careerGoals: any;
    persona: any;
    extractedData: any;
    basicInfo?: any;
    targetJob?: any;
    personaData?: any;
  }> {
    const profile = await this.getProfile(userId);

    return {
      careerGoals: profile.careerGoals || {},
      persona: profile.persona || {},
      extractedData: profile.extractedData || {},
      basicInfo: profile.basicInfo || {},
      targetJob: profile.targetJob || {},
      personaData: profile.personaData || {},
    };
  }

  async markSectionComplete(
    userId: string,
    section: keyof ProfessionalProfile['completedSections'],
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);

    if (!profile.completedSections) {
      profile.completedSections = {};
    }
    profile.completedSections[section] = true;

    return await this.profileRepository.save(profile);
  }
}
