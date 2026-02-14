import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeadshotGeneration, HeadshotStatus, HeadshotStyle, HeadshotPersonaType } from './entities/headshot-generation.entity';
import { HeadshotGenerationService } from './services/headshot-generation.service';
import { ProfessionalProfileService } from '../professional-profile/professional-profile.service';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';

@Injectable()
export class HeadshotGeneratorService {
  private readonly logger = new Logger(HeadshotGeneratorService.name);

  constructor(
    @InjectRepository(HeadshotGeneration)
    private headshotGenerationRepository: Repository<HeadshotGeneration>,
    private headshotGenerationService: HeadshotGenerationService,
    private professionalProfileService: ProfessionalProfileService,
    private usageTrackingService: UsageTrackingService,
    private dashboardEventService: DashboardEventService,
  ) {}

  /**
   * Upload original image
   */
  async uploadImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const imageUrl = await this.headshotGenerationService.uploadOriginalImage(file, userId);
    return imageUrl;
  }

  /**
   * Generate headshots
   */
  async generateHeadshots(
    userId: string,
    originalImageUrl: string,
    style: HeadshotStyle,
    personaType?: HeadshotPersonaType,
  ): Promise<HeadshotGeneration> {
    try {
      // If persona type not provided, get from profile
      let finalPersonaType = personaType;
      if (!finalPersonaType) {
        const profile = await this.professionalProfileService.getProfile(userId);
        if (profile.personaData?.currentPersona) {
          // Map persona archetype to headshot persona type
          finalPersonaType = this.mapPersonaToHeadshotType(profile.personaData.currentPersona as string);
        } else {
          finalPersonaType = HeadshotPersonaType.TrustworthyProfessional;
        }
      }

      // Create generation record
      const generation = this.headshotGenerationRepository.create({
        userId,
        originalImageUrl,
        style,
        personaType: finalPersonaType,
        status: HeadshotStatus.Processing,
      });

      const saved = await this.headshotGenerationRepository.save(generation);

      try {
        // Generate headshots
        const generatedUrls = await this.headshotGenerationService.generateHeadshots(
          originalImageUrl,
          style,
          finalPersonaType,
          userId,
          saved.id,
        );

        // Update generation with results
        saved.generatedImages = generatedUrls;
        saved.status = HeadshotStatus.Completed;

        const completed = await this.headshotGenerationRepository.save(saved);

        // Track headshot generation
        this.usageTrackingService
          .trackAction(userId, 'headshots_generated', 'headshot-generator', {
            generationId: completed.id,
            style,
            personaType: finalPersonaType,
          })
          .catch((err) => console.error('Failed to track headshot generation:', err));
        this.dashboardEventService.emitFeatureUsed(userId, 'headshot-generator', 'headshots_generated');

        return completed;
      } catch (error) {
        this.logger.error('Error during headshot generation', error);
        saved.status = HeadshotStatus.Failed;
        await this.headshotGenerationRepository.save(saved);
        throw error;
      }
    } catch (error) {
      this.logger.error('Error generating headshots', error);
      throw error;
    }
  }

  /**
   * Get generation by ID
   */
  async getGeneration(id: string, userId: string): Promise<HeadshotGeneration> {
    const generation = await this.headshotGenerationRepository.findOne({
      where: { id, userId },
    });

    if (!generation) {
      throw new NotFoundException('Headshot generation not found');
    }

    return generation;
  }

  /**
   * Get all generations for user
   */
  async getUserGenerations(userId: string): Promise<HeadshotGeneration[]> {
    return await this.headshotGenerationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Map persona archetype to headshot persona type
   */
  private mapPersonaToHeadshotType(persona: string): HeadshotPersonaType {
    const lowerPersona = persona.toLowerCase();
    if (lowerPersona.includes('leader') || lowerPersona.includes('executive')) {
      return HeadshotPersonaType.ConfidentLeader;
    } else if (lowerPersona.includes('innovator') || lowerPersona.includes('creative')) {
      return HeadshotPersonaType.InnovativeThinker;
    } else if (lowerPersona.includes('collaborator') || lowerPersona.includes('team')) {
      return HeadshotPersonaType.ApproachableExpert;
    } else {
      return HeadshotPersonaType.TrustworthyProfessional;
    }
  }
}








