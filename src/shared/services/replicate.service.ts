import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Replicate from 'replicate';

@Injectable()
export class ReplicateService {
  private readonly logger = new Logger(ReplicateService.name);
  private readonly replicate: Replicate;

  constructor(private configService: ConfigService) {
    const apiToken = this.configService.get<string>('REPLICATE_API_TOKEN');
    
    if (!apiToken) {
      this.logger.warn(
        'REPLICATE_API_TOKEN not set. Image generation will not work.',
      );
    } else {
      this.replicate = new Replicate({ auth: apiToken });
    }
  }

  /**
   * Generate professional headshot from user photo
   */
  async generateHeadshot(
    imageUrl: string,
    style: 'corporate' | 'modern' | 'executive' | 'creative',
    persona: 'confident-leader' | 'approachable-expert' | 'innovative-thinker' | 'trustworthy-professional',
  ): Promise<string[]> {
    if (!this.replicate) {
      throw new BadRequestException('Replicate API not configured');
    }

    try {
      // Use a professional headshot generation model
      // Note: You'll need to select the appropriate Replicate model for headshot generation
      // This is a placeholder model - replace with actual headshot generation model
      const model = 'lucataco/faceswap:9c4bb465fca90666e07671373a2ad5dd1a817ec3b25074d90918b00b75d1374c';
      
      // For now, return placeholder URLs
      // In production, you would:
      // 1. Download the image from imageUrl
      // 2. Use Replicate API to generate headshots
      // 3. Upload generated images to Supabase
      // 4. Return the Supabase URLs
      
      this.logger.warn('Headshot generation model needs to be configured with appropriate Replicate model');
      
      // Placeholder - return array of URLs
      // Replace this with actual Replicate API call
      return [imageUrl, imageUrl, imageUrl, imageUrl];
    } catch (error) {
      this.logger.error('Error generating headshot', error);
      throw new BadRequestException(`Failed to generate headshot: ${error.message}`);
    }
  }

  /**
   * Build prompt for headshot generation based on style and persona
   */
  private buildHeadshotPrompt(
    style: string,
    persona: string,
  ): string {
    const stylePrompts = {
      corporate: 'professional business attire, neutral background, confident pose, crisp lighting, executive headshot',
      modern: 'contemporary professional style, soft lighting, smooth background gradients, approachable authority',
      executive: 'premium attire, darker tones, sharp lighting, leadership energy, high-end professional',
      creative: 'colorful but clean backgrounds, stylish outfits, artistic composition, modern professional',
    };

    const personaPrompts = {
      'confident-leader': 'strong chin, direct eye contact, small controlled smile, assertive posture',
      'approachable-expert': 'softer expression, slight smile, welcoming posture, warm eyes',
      'innovative-thinker': 'dynamic angle, thoughtful gaze, creative energy, modern style',
      'trustworthy-professional': 'gentle smile, relaxed shoulders, warm eyes, reliable appearance',
    };

    return `Professional headshot portrait, ${stylePrompts[style]}, ${personaPrompts[persona]}, high quality, professional photography, studio lighting, 8k resolution`;
  }
}

