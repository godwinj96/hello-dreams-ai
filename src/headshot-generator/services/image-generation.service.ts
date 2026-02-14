import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HfInference } from '@huggingface/inference';
import OpenAI, { toFile } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HeadshotStyle, HeadshotPersonaType } from '../entities/headshot-generation.entity';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

type GenerationResult = {
  buffers: Buffer[];
  provider: 'gemini' | 'huggingface' | 'openai';
};

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private readonly geminiClient?: GoogleGenerativeAI;
  private readonly hf?: HfInference;
  private readonly openai?: OpenAI;
  private readonly hfImg2ImgModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      this.logger.log('Gemini 2.5 Flash Image generation enabled.');
    } else {
      this.logger.warn('GEMINI_API_KEY not set. Gemini generation disabled.');
      // Debug: Check if it exists in process.env directly
      if (process.env.GEMINI_API_KEY) {
        this.logger.warn('GEMINI_API_KEY found in process.env but not in ConfigService. Check .env file location and ConfigModule setup.');
      }
    }

    const hfKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
    if (hfKey) {
      this.hf = new HfInference(hfKey);
      this.logger.log('HuggingFace image generation enabled.');
    } else {
      this.logger.warn('HUGGINGFACE_API_KEY not set. HuggingFace generation disabled.');
      // Debug: Check if it exists in process.env directly
      if (process.env.HUGGINGFACE_API_KEY) {
        this.logger.warn('HUGGINGFACE_API_KEY found in process.env but not in ConfigService. Check .env file location and ConfigModule setup.');
      }
    }

    // Allow overriding the image-to-image model via env; default to HF-supported img2img model.
    // Using a model that supports image-to-image via HuggingFace Inference API
    // Note: Not all models support image-to-image. If this model fails, set HUGGINGFACE_IMAGE2IMAGE_MODEL
    // to a model that supports img2img, or the system will fall back to text-to-image
    this.hfImg2ImgModel =
      this.configService.get<string>('HUGGINGFACE_IMAGE2IMAGE_MODEL') ||
      'timbrooks/instruct-pix2pix';

    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.logger.log('OpenAI image generation enabled.');
    } else {
      this.logger.warn('OPENAI_API_KEY not set. OpenAI image generation disabled.');
    }
  }

  private async toBuffer(result: unknown): Promise<Buffer> {
    // Handle Gemini response format (base64 string)
    if (typeof result === 'string') {
      return Buffer.from(result, 'base64');
    }
    // HuggingFace SDK may return Blob/ArrayBuffer/Uint8Array depending on runtime.
    if (result instanceof Uint8Array) return Buffer.from(result);
    if (result instanceof ArrayBuffer) return Buffer.from(new Uint8Array(result));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyResult = result as any;
    if (anyResult && typeof anyResult.arrayBuffer === 'function') {
      const ab: ArrayBuffer = await anyResult.arrayBuffer();
      return Buffer.from(new Uint8Array(ab));
    }
    throw new BadRequestException(
      `Unexpected image result type from provider: ${Object.prototype.toString.call(result)}`,
    );
  }

  private extractStoragePathFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      // Typical forms:
      // /storage/v1/object/public/<bucket>/<path>
      // /storage/v1/object/sign/<bucket>/<path>?token=...
      const idx = u.pathname.indexOf('/storage/v1/object/');
      if (idx === -1) return null;
      const rest = u.pathname.slice(idx + '/storage/v1/object/'.length); // e.g. public/bucket/path...
      const parts = rest.split('/').filter(Boolean);
      // parts[0] = public|sign|authenticated|...
      // parts[1] = bucket
      // parts[2..] = path
      if (parts.length < 3) return null;
      const bucket = parts[1];
      // We only support our configured bucket here; otherwise we'd need a bucket param.
      if (bucket !== 'headshot-originals') return parts.slice(2).join('/');
      return parts.slice(2).join('/');
    } catch {
      return null;
    }
  }

  private async fetchReferenceImageAsBuffer(originalImageUrl: string): Promise<Buffer> {
    // IMPORTANT: bucket is private, so /object/public/... URLs will 400.
    // Use server-side Supabase download() which respects RLS policies.
    const filePath = this.extractStoragePathFromUrl(originalImageUrl);
    if (filePath) {
      return await this.supabaseStorageService.downloadFile(filePath);
    }

    // Fallback: try plain fetch if it's not a Supabase Storage URL.
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

    // Log the exact prompt used for headshot generation for debugging and monitoring.
    // This helps diagnose bias or unexpected outputs without changing generation behavior.
    this.logger.log(
      `Headshot generation prompt (style=${style}, persona=${persona}): ${prompt}`,
    );

    // CRITICAL: Fetch reference image first - we need it for professional headshot generation
    // For professional headshots, we MUST have the reference image to preserve identity
    let referenceBuffer: Buffer | null = null;
    try {
      referenceBuffer = await this.fetchReferenceImageAsBuffer(originalImageUrl);
      this.logger.log('Successfully fetched reference image for headshot generation');
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      this.logger.error(
        `Failed to fetch reference image. Professional headshot generation requires a reference image. Reason: ${msg}`,
      );
      // Don't fall back to text-only generation for professional headshots
      // This ensures we always preserve the user's identity
      throw new BadRequestException(
        `Failed to fetch reference image: ${msg}. Reference image is required for professional headshot generation.`,
      );
    }

    // Use OpenAI images.edit() API with gpt-image-1.5 for direct image-to-image editing
    // This is the best approach as it directly edits the reference image while preserving identity
    if (this.openai) {
      const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
      // NOTE: As of current OpenAI API behavior, /images/edits officially supports `dall-e-2`.
      // We still allow overriding this via env so you can experiment, but default to the
      // supported model to avoid hard 400s like "Value must be 'dall-e-2'".
      const openaiImageEditModel =
        this.configService.get<string>('OPENAI_IMAGE_EDIT_MODEL') || 'dall-e-2';

      try {
        const buffers: Buffer[] = [];

        // Generate multiple headshot variations by editing the reference image
        for (let i = 0; i < count; i++) {
          try {
            // Use fetch + OpenAI Images API (edits) to directly edit the reference image.
            // This preserves identity much better than text-to-image generation.
            // We send the reference image as multipart/form-data.
            const formData = new FormData();
            formData.append('model', openaiImageEditModel);
            formData.append('prompt', prompt);
            formData.append('size', '1024x1024');
            formData.append('n', '1');
            formData.append(
              'image',
              new Blob([new Uint8Array(referenceBuffer)], {
                type: 'image/jpeg',
              }),
              'reference.jpg',
            );

            const res = await fetch('https://api.openai.com/v1/images/edits', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${openaiApiKey}`,
              },
              body: formData,
            });

            if (!res.ok) {
              const errorBody = await res.text();
              throw new BadRequestException(
                `OpenAI images.edit() request failed (${res.status} ${res.statusText}): ${errorBody}`,
              );
            }

            // Response format: { data: [{ b64_json?: string; url?: string; }] }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const json: any = await res.json();
            const first = json?.data?.[0];
            if (!first?.b64_json) {
              throw new BadRequestException('OpenAI images.edit() returned no image data.');
            }

            buffers.push(Buffer.from(first.b64_json, 'base64'));
          } catch (editError) {
            // If images.edit() fails, log and try next iteration
            const errorMsg = editError instanceof Error ? editError.message : JSON.stringify(editError);
            this.logger.warn(
              `OpenAI images.edit() failed for image ${i + 1}/${count}: ${errorMsg}`,
            );
            
            // If it's a model not found error, break and try other providers
            if (errorMsg.includes('model') || errorMsg.includes('not found') || errorMsg.includes('invalid')) {
              throw editError;
            }
            
            // For other errors, continue to next iteration
            continue;
          }
        }

        if (!buffers.length) {
          throw new BadRequestException(
            'OpenAI images.edit() failed to generate any images. Trying other providers.',
          );
        }

        this.logger.log(
          `Successfully generated ${buffers.length} headshots using OpenAI images.edit() with gpt-image-1.5`,
        );
        return { buffers, provider: 'openai' };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(
          `OpenAI images.edit() failed: ${errorMsg}. Trying other providers.`,
        );
        // Continue to fallbacks - other providers may support image-to-image better
      }
    }

    // Fallback to Gemini 2.5 Flash Image with reference image support
    if (this.geminiClient && referenceBuffer) {
      try {
        const buffers: Buffer[] = [];
        const model = this.geminiClient.getGenerativeModel({
          model: 'gemini-2.5-flash-image',
        });

        // Convert reference buffer to base64 for Gemini
        const referenceBase64 = referenceBuffer.toString('base64');
        const referenceMimeType = 'image/jpeg';

        // Enhanced prompt that explicitly references the input image
        const enhancedPrompt = `${prompt}. Use the provided reference photo to maintain the exact same person's facial features, bone structure, and identity. Only change clothing, background, lighting, and professional styling while preserving all facial characteristics.`;

        for (let i = 0; i < count; i++) {
          // Gemini supports multimodal input - include both image and text
          const result = await model.generateContent([
            {
              inlineData: {
                data: referenceBase64,
                mimeType: referenceMimeType,
              },
            },
            { text: enhancedPrompt },
          ]);
          
          const response = result.response;

          // Extract image data from response
          // Gemini returns images as inline data in response parts
          const parts = response.candidates?.[0]?.content?.parts;
          if (!parts || parts.length === 0) {
            throw new BadRequestException('Gemini returned no content parts.');
          }

          // Find the part with inline data (image)
          const imagePart = parts.find((part: any) => part.inlineData);
          if (!imagePart || !imagePart.inlineData) {
            throw new BadRequestException('Gemini response does not contain image data.');
          }

          // Convert base64 string to Buffer
          const imageData = imagePart.inlineData.data;
          buffers.push(await this.toBuffer(imageData));
        }

        this.logger.log(`Successfully generated ${buffers.length} headshots using Gemini with reference image`);
        return { buffers, provider: 'gemini' };
      } catch (error) {
        // Log error details
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(
          `Gemini generation with reference image failed, trying HuggingFace. Reason: ${message}`,
        );
        // Continue to fallback
      }
    }

    // Fallback to HuggingFace image-to-image (best fallback as it properly uses reference images)
    if (this.hf && referenceBuffer) {
      try {
        const buffers: Buffer[] = [];
        // HF endpoints are picky: send a proper Blob with MIME type, not a raw Buffer.
        const referenceBlob = new Blob([new Uint8Array(referenceBuffer)], {
          type: 'image/jpeg',
        });
        
        // Enhanced prompt for better identity preservation
        const enhancedPrompt = `${prompt}. Maintain the exact same person's facial features and identity from the reference image.`;
        
        for (let i = 0; i < count; i++) {
          // Use image-to-image so we send the actual photo bytes (not a URL in the prompt).
          // This is the most reliable way to preserve identity for professional headshots.
          try {
            const result = await this.hf.imageToImage({
              // IMPORTANT: Without this, the HF SDK may auto-select a 3rd-party provider
              // (based on your HF account settings) that doesn't support image-to-image.
              // For our use case we need a provider that supports image-to-image.
              model: this.hfImg2ImgModel,
              inputs: referenceBlob,
              parameters: { 
                prompt: enhancedPrompt,
                // Add parameters to preserve identity better
                strength: 0.7, // Lower strength = more preservation of original image (0.0-1.0)
                guidance_scale: 7.5, // How closely to follow the prompt
              },
            });
            buffers.push(await this.toBuffer(result));
          } catch (img2imgError) {
            // If image-to-image fails, try text-to-image with enhanced prompt as last resort
            this.logger.warn(
              `HuggingFace image-to-image failed for image ${i + 1}, trying text-to-image fallback`,
              img2imgError,
            );
            
            // Fallback to text-to-image with very detailed prompt
            const fallbackResult = await this.hf.textToImage({
              model: 'stabilityai/stable-diffusion-2-1',
              inputs: enhancedPrompt,
              parameters: {
                num_inference_steps: 50,
                guidance_scale: 7.5,
              },
            });
            buffers.push(await this.toBuffer(fallbackResult));
          }
        }

        if (!buffers.length) {
          throw new BadRequestException('HuggingFace returned no images.');
        }

        this.logger.log(`Successfully generated ${buffers.length} headshots using HuggingFace`);
        return { buffers, provider: 'huggingface' };
      } catch (error) {
        // Log as much as we can for 400s (HF often includes useful JSON body)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyErr = error as any;
        if (anyErr?.response) {
          try {
            const status = anyErr.response.status;
            const body =
              typeof anyErr.response.text === 'function'
                ? await anyErr.response.text()
                : anyErr.response.data ?? anyErr.response.body;
            this.logger.error(`HuggingFace error ${status}: ${body}`);
          } catch (e) {
            this.logger.error('Failed to read HuggingFace error response', e);
          }
        }
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.error(
          `HuggingFace image-to-image generation failed. Reason: ${message}`,
        );
        // Don't throw here - we want to show the final error message
      }
    }

    // Fallback to OpenAI images
    // if (this.openai) {
    //   try {
    //     const response = await this.openai.images.generate({
    //       model: 'gpt-image-1',
    //       prompt,
    //       n: count,
    //       size: '1024x1024',
    //       response_format: 'b64_json',
    //     });

    //     const buffers =
    //       response.data
    //         ?.map((item) => item.b64_json)
    //         .filter((val): val is string => Boolean(val))
    //         .map((b64) => Buffer.from(b64, 'base64')) ?? [];

    //     if (!buffers.length) {
    //       throw new BadRequestException('OpenAI returned no images.');
    //     }

    //     return { buffers, provider: 'openai' };
    //   } catch (error) {
    //     this.logger.error('OpenAI image generation failed', error);
    //     throw new BadRequestException(`Image generation failed: ${error.message}`);
    //   }
    // }

    // If we reach here, all providers failed
    // This should not happen if reference image was successfully fetched
    throw new BadRequestException(
      'Professional headshot generation failed. All available providers (OpenAI, Gemini, HuggingFace) failed to generate headshots from the reference image. Check server logs for details. Ensure your API keys are configured correctly and the reference image is valid.',
    );
  }

  private buildHeadshotPrompt(
    style: HeadshotStyle,
    persona: HeadshotPersonaType,
  ): string {
    // IMPORTANT: This prompt must NOT describe any specific facial or bodily features
    // (eyes, chin, jawline, hair, skin, age, body type, etc.).
    // It should:
    // - Explicitly instruct the model to keep the same identity as the original/reference photo.
    // - Focus only on clothing, posture, background, lighting, composition, and overall professional mood.
    // - Emphasize identity preservation for professional headshot generation
    const identityPrefix =
      'Professional studio headshot photograph. CRITICAL: Maintain the exact same person from the reference image - preserve all facial features, bone structure, and physical characteristics. Only modify: clothing, background, lighting, and professional styling. High-quality professional photography, studio lighting, ultra-detailed, 8k resolution, professional headshot quality';

    const stylePrompts: Record<HeadshotStyle, string> = {
      [HeadshotStyle.Corporate]:
        'well-fitted business blazer or suit jacket over a dress shirt, neutral office or studio background, medium-close crop (head and shoulders), clean and balanced studio lighting, polished corporate look, professional business attire',
      [HeadshotStyle.Modern]:
        'smart-casual professional clothing, subtle modern color palette, soft gradient or airy office background, soft directional lighting, contemporary professional style, modern professional attire',
      [HeadshotStyle.Executive]:
        'tailored dark suit or blazer with understated tones, subtle textured studio background, refined studio lighting with gentle contrast, high-end executive presentation, premium professional styling',
      [HeadshotStyle.Creative]:
        'stylish, modern professional outfit with a bit of personality, slightly more colorful or textured background, thoughtful composition, creative but polished professional look, contemporary professional styling',
    };

    const personaPrompts: Record<HeadshotPersonaType, string> = {
      [HeadshotPersonaType.ConfidentLeader]:
        'upright, balanced posture, composed presence, decisive and confident professional mood, professional expression',
      [HeadshotPersonaType.ApproachableExpert]:
        'open, relaxed posture, welcoming professional demeanor, collaborative and supportive atmosphere, friendly professional expression',
      [HeadshotPersonaType.InnovativeThinker]:
        'slightly dynamic but natural pose, modern environment, subtle sense of curiosity, innovation, and forward-thinking energy, engaging professional expression',
      [HeadshotPersonaType.TrustworthyProfessional]:
        'steady, composed posture, calm and reliable presence, subtle professional warmth and dependability, trustworthy professional expression',
    };

    return [
      identityPrefix,
      stylePrompts[style],
      personaPrompts[persona],
      'Maintain exact facial identity from reference photo',
    ].join(', ');
  }
}

