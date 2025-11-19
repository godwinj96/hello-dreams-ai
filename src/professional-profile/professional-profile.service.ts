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

  async getProfileForGeneration(userId: string): Promise<{
    careerGoals: any;
    persona: any;
    extractedData: any;
  }> {
    const profile = await this.getProfile(userId);
    
    return {
      careerGoals: profile.careerGoals || {},
      persona: profile.persona || {},
      extractedData: profile.extractedData || {},
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

