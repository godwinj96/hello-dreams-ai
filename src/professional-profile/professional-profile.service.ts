import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfessionalProfile } from './entities/professional-profile.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ProfessionalProfileService {
  private readonly logger = new Logger(ProfessionalProfileService.name);

  constructor(
    @InjectRepository(ProfessionalProfile)
    private profileRepository: Repository<ProfessionalProfile>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getProfile(userId: string): Promise<ProfessionalProfile> {
    let profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      // Create profile if it doesn't exist, seeded from the signup account so
      // contact details are correct before any AI extraction runs.
      profile = this.profileRepository.create({
        userId,
        careerGoals: {},
        persona: {},
        extractedData: {},
        completedSections: {},
        basicInfo: await this.buildSeedBasicInfo(userId),
      });
      profile = await this.profileRepository.save(profile);
      return profile;
    }

    // Backfill for profiles created before the account seed existed. Without
    // this, generated documents show whatever the model guessed from the chat.
    if (!profile.basicInfo?.email || !profile.basicInfo?.name) {
      const seed = await this.buildSeedBasicInfo(userId);
      const merged = {
        ...seed,
        ...Object.fromEntries(
          Object.entries(profile.basicInfo ?? {}).filter(
            ([, value]) =>
              value !== undefined && value !== null && value !== '',
          ),
        ),
      };
      // The account address wins: it is verified, the extracted one is guessed.
      if (seed.email) merged.email = seed.email;
      profile.basicInfo = merged;
      profile = await this.profileRepository.save(profile);
    }

    return profile;
  }

  /** Contact details taken from the user's account record. */
  private async buildSeedBasicInfo(
    userId: string,
  ): Promise<ProfessionalProfile['basicInfo']> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return {};
    return {
      ...(user.name ? { name: user.name } : {}),
      ...(user.email ? { email: user.email } : {}),
    };
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

  /**
   * Internal keys that must never reach a prompt or an API response.
   *
   * `_preCleanupBackup` holds the pre-sanitisation copy of a profile field.
   * Leaving it in would feed the very leaked-prompt text we cleaned straight
   * back into every generation.
   */
  private static readonly INTERNAL_KEYS = ['_preCleanupBackup'];

  private stripInternal<T extends Record<string, any> | null | undefined>(
    value: T,
  ): Record<string, any> {
    if (!value || typeof value !== 'object') return {};
    const copy: Record<string, any> = { ...value };
    for (const key of ProfessionalProfileService.INTERNAL_KEYS) {
      delete copy[key];
    }
    return copy;
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
      careerGoals: this.stripInternal(profile.careerGoals),
      persona: this.stripInternal(profile.persona),
      extractedData: this.stripInternal(profile.extractedData),
      basicInfo: this.stripInternal(profile.basicInfo),
      targetJob: this.stripInternal(profile.targetJob),
      personaData: this.stripInternal(profile.personaData),
    };
  }

  /** Same profile with internal keys removed, for API responses. */
  async getPublicProfile(userId: string): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);
    return {
      ...profile,
      careerGoals: this.stripInternal(profile.careerGoals),
      extractedData: this.stripInternal(profile.extractedData),
    } as unknown as ProfessionalProfile;
  }

  /** Stores the AI-written career narrative on the profile. */
  async saveCareerSummary(
    userId: string,
    careerSummary: string,
  ): Promise<ProfessionalProfile> {
    const profile = await this.getProfile(userId);
    profile.extractedData = {
      ...(profile.extractedData ?? {}),
      careerSummary,
      careerSummaryGeneratedAt: new Date().toISOString(),
    };
    return await this.profileRepository.save(profile);
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
