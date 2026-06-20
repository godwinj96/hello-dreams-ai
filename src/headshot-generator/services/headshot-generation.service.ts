import { Injectable, Logger } from '@nestjs/common';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import {
  HeadshotStyle,
  HeadshotPersonaType,
} from '../entities/headshot-generation.entity';
import { ImageGenerationService } from './image-generation.service';

@Injectable()
export class HeadshotGenerationService {
  private readonly logger = new Logger(HeadshotGenerationService.name);

  constructor(
    private imageGenerationService: ImageGenerationService,
    private supabaseStorageService: SupabaseStorageService,
  ) {}

  /**
   * Generate headshot variations
   */
  async generateHeadshots(
    originalImageUrl: string,
    style: HeadshotStyle,
    personaType: HeadshotPersonaType,
    userId: string,
    generationId: string,
  ): Promise<{
    urls: string[];
    imageCount: number;
    model: string;
    size: string;
    quality: 'low' | 'medium' | 'high';
  }> {
    try {
      const generationResult =
        await this.imageGenerationService.generateHeadshots(
          originalImageUrl,
          style,
          personaType,
        );

      this.logger.log(
        `Headshots generated using provider: ${generationResult.provider}`,
      );

      const generatedImageUrls = await this.uploadGeneratedImages(
        generationResult.buffers,
        userId,
        generationId,
      );

      return {
        urls: generatedImageUrls,
        imageCount: generationResult.imageCount,
        model: generationResult.model,
        size: generationResult.size,
        quality: generationResult.quality,
      };
    } catch (error) {
      this.logger.error('Error generating headshots', error);
      throw error;
    }
  }

  /**
   * Upload original image and get URL
   */
  async uploadOriginalImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return await this.supabaseStorageService.uploadFile(
      file,
      'headshots/original',
      userId,
    );
  }

  /**
   * Upload generated images and get URLs
   */
  async uploadGeneratedImages(
    imageBuffers: Buffer[],
    userId: string,
    generationId: string,
  ): Promise<string[]> {
    const urls: string[] = [];

    for (let i = 0; i < imageBuffers.length; i++) {
      const fileName = `${generationId}-variation-${i + 1}.png`;
      const url = await this.supabaseStorageService.uploadBuffer(
        imageBuffers[i],
        fileName,
        'image/png',
        'headshots/generated',
        userId,
      );
      urls.push(url);
    }

    return urls;
  }
}
