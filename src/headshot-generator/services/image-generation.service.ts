import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import { HeadshotStyle, HeadshotPersonaType } from '../entities/headshot-generation.entity';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

type GenerationResult = {
  buffers: Buffer[];
  provider: 'openai';
  imageCount: number;
  model: string;
  size: string;
  quality: 'low' | 'medium' | 'high';
};

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private readonly openai: OpenAI;
  private readonly model: string;
  private readonly imageQuality: 'low' | 'medium' | 'high';

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is required but not configured.');
    }
    this.openai = new OpenAI({ apiKey: openaiKey });
    this.model = this.configService.get<string>('OPENAI_IMAGE_MODEL', 'gpt-image-1');
    const quality = this.configService.get<string>('OPENAI_IMAGE_QUALITY', 'medium');
    this.imageQuality =
      quality === 'low' || quality === 'high' ? quality : 'medium';
    this.logger.log(`OpenAI image generation enabled (model: ${this.model}).`);
  }

  private extractStoragePathFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const idx = u.pathname.indexOf('/storage/v1/object/');
      if (idx === -1) return null;
      // pathname after /storage/v1/object/ looks like: public/<bucket>/<path>
      //                                              or: sign/<bucket>/<path>
      const rest = u.pathname.slice(idx + '/storage/v1/object/'.length);
      const parts = rest.split('/').filter(Boolean);
      // parts[0] = public|sign|authenticated, parts[1] = bucket, parts[2..] = path
      if (parts.length < 3) return null;
      return parts.slice(2).join('/');
    } catch {
      return null;
    }
  }

  private async fetchReferenceImageAsBuffer(originalImageUrl: string): Promise<Buffer> {
    // Bucket is private — use Supabase server-side download() to bypass RLS
    const filePath = this.extractStoragePathFromUrl(originalImageUrl);
    if (filePath) {
      this.logger.log(`Downloading reference image via Supabase storage: ${filePath}`);
      return await this.supabaseStorageService.downloadFile(filePath);
    }

    // Fallback: plain fetch for non-Supabase URLs
    this.logger.log(`Fetching reference image via HTTP: ${originalImageUrl}`);
    const res = await fetch(originalImageUrl);
    if (!res.ok) {
      throw new BadRequestException(
        `Failed to fetch reference image (${res.status} ${res.statusText})`,
      );
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(new Uint8Array(ab));
  }

  async generateHeadshots(
    originalImageUrl: string,
    style: HeadshotStyle,
    persona: HeadshotPersonaType,
    count = 4,
  ): Promise<GenerationResult> {
    const prompt = this.buildHeadshotPrompt(style, persona);

    this.logger.log(
      `Generating ${count} headshots — model: ${this.model}, style: ${style}, persona: ${persona}`,
    );

    // Fetch the reference image (required for identity-preserving generation)
    let referenceBuffer: Buffer;
    try {
      referenceBuffer = await this.fetchReferenceImageAsBuffer(originalImageUrl);
      this.logger.log('Reference image fetched successfully.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to fetch reference image: ${msg}`);
      throw new BadRequestException(
        `Failed to fetch reference image: ${msg}. A reference image is required for headshot generation.`,
      );
    }

    try {
      // gpt-image-1 supports `n` images in a single call — no need to loop
      const response = await this.openai.images.edit({
        model: this.model,
        image: await toFile(referenceBuffer, 'reference.jpg', { type: 'image/jpeg' }),
        prompt,
        n: count,
        size: '1024x1024',
      });

      const buffers = (response.data ?? [])
        .map((item) => item.b64_json)
        .filter((b64): b64 is string => Boolean(b64))
        .map((b64) => Buffer.from(b64, 'base64'));

      if (!buffers.length) {
        throw new BadRequestException('OpenAI returned no image data.');
      }

      this.logger.log(`Successfully generated ${buffers.length} headshot(s) via OpenAI.`);
      return {
        buffers,
        provider: 'openai',
        imageCount: buffers.length,
        model: this.model,
        size: '1024x1024',
        quality: this.imageQuality,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenAI image generation failed: ${msg}`);
      throw new BadRequestException(`Headshot generation failed: ${msg}`);
    }
  }

  private buildHeadshotPrompt(style: HeadshotStyle, persona: HeadshotPersonaType): string {
    // IMPORTANT: Do NOT describe specific facial features (eyes, skin, hair, age, body type).
    // Only describe clothing, background, lighting, posture, and professional mood.
    // Identity is preserved via the reference image — the prompt drives styling only.
    const identityPrefix =
      'Professional studio headshot photograph. ' +
      'CRITICAL: Maintain the exact same person from the reference image — ' +
      'preserve all facial features, bone structure, and physical characteristics. ' +
      'Only modify: clothing, background, lighting, and professional styling. ' +
      'High-quality professional photography, studio lighting, ultra-detailed, 8k resolution.';

    const stylePrompts: Record<HeadshotStyle, string> = {
      [HeadshotStyle.Corporate]:
        'Well-fitted business blazer or suit jacket over a dress shirt, neutral office or studio background, ' +
        'medium-close crop (head and shoulders), clean and balanced studio lighting, polished corporate look.',
      [HeadshotStyle.Modern]:
        'Smart-casual professional clothing, subtle modern colour palette, soft gradient or airy office background, ' +
        'soft directional lighting, contemporary professional style.',
      [HeadshotStyle.Executive]:
        'Tailored dark suit or blazer with understated tones, subtle textured studio background, ' +
        'refined studio lighting with gentle contrast, high-end executive presentation.',
      [HeadshotStyle.Creative]:
        'Stylish modern professional outfit with personality, slightly more colourful or textured background, ' +
        'thoughtful composition, creative but polished professional look.',
    };

    const personaPrompts: Record<HeadshotPersonaType, string> = {
      [HeadshotPersonaType.ConfidentLeader]:
        'Upright, balanced posture, composed presence, decisive and confident professional expression.',
      [HeadshotPersonaType.ApproachableExpert]:
        'Open, relaxed posture, welcoming professional demeanour, collaborative and friendly expression.',
      [HeadshotPersonaType.InnovativeThinker]:
        'Slightly dynamic but natural pose, subtle sense of curiosity and forward-thinking energy, engaging expression.',
      [HeadshotPersonaType.TrustworthyProfessional]:
        'Steady, composed posture, calm and reliable presence, subtle professional warmth and dependability.',
    };

    return [
      identityPrefix,
      stylePrompts[style],
      personaPrompts[persona],
      'Maintain exact facial identity from the reference photo.',
    ].join(' ');
  }
}
