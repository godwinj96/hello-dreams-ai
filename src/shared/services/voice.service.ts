import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set. Voice services will not work.',
      );
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Transcribe audio to text using OpenAI Whisper
   */
  async speechToText(audioFile: Express.Multer.File): Promise<string> {
    if (!this.openai) {
      throw new BadRequestException('OpenAI API not configured');
    }

    try {
      // Create a temporary file from the buffer
      const tempFilePath = path.join(
        process.cwd(),
        'temp',
        `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.${audioFile.originalname.split('.').pop()}`,
      );

      // Ensure temp directory exists
      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Write buffer to temp file
      fs.writeFileSync(tempFilePath, audioFile.buffer);

      try {
        // Create a file stream
        const fileStream = fs.createReadStream(tempFilePath);

        // Transcribe using Whisper
        const transcription = await this.openai.audio.transcriptions.create({
          file: fileStream as any,
          model: 'whisper-1',
          language: 'en', // Can be made configurable
        });

        return transcription.text;
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    } catch (error) {
      this.logger.error('Error in speechToText', error);
      throw new BadRequestException(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Convert text to speech using OpenAI TTS
   */
  async textToSpeech(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'): Promise<Buffer> {
    if (!this.openai) {
      throw new BadRequestException('OpenAI API not configured');
    }

    try {
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;
    } catch (error) {
      this.logger.error('Error in textToSpeech', error);
      throw new BadRequestException(`Failed to generate speech: ${error.message}`);
    }
  }
}














