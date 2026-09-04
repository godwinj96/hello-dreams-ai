import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserContextEmbedding } from './entities/user-context-embedding.entity';
import { Resume } from '../resume-builder/entities/resume.entity';
import { ResumeData } from '../resume-builder/entities/resume-data.entity';
import { Document } from '../document-generator/entities/document.entity';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';
import { SupabaseStorageService } from './services/supabase-storage.service';
import { VoiceService } from './services/voice.service';
import { OpenAIService } from './services/openai.service';
import { GeminiService } from './services/gemini.service';
import { PromptInjectionGuardService } from './services/prompt-injection-guard.service';
import { EmbeddingService } from './services/embedding.service';
import { EmbeddingRetryService } from './services/embedding-retry.service';
import { ContextIndexerService } from './services/context-indexer.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      UserContextEmbedding,
      Resume,
      ResumeData,
      Document,
    ]),
    ProfessionalProfileModule,
  ],
  providers: [
    SupabaseStorageService,
    VoiceService,
    OpenAIService,
    GeminiService,
    PromptInjectionGuardService,
    EmbeddingService,
    EmbeddingRetryService,
    ContextIndexerService,
  ],
  exports: [
    SupabaseStorageService,
    VoiceService,
    OpenAIService,
    GeminiService,
    PromptInjectionGuardService,
    EmbeddingService,
    ContextIndexerService,
  ],
})
export class SharedModule {}
