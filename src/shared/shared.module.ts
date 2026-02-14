import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserContextEmbedding } from './entities/user-context-embedding.entity';
import { SupabaseStorageService } from './services/supabase-storage.service';
import { VoiceService } from './services/voice.service';
import { OpenAIService } from './services/openai.service';
import { ReplicateService } from './services/replicate.service';
import { PromptInjectionGuardService } from './services/prompt-injection-guard.service';
import { EmbeddingService } from './services/embedding.service';
import { ContextIndexerService } from './services/context-indexer.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserContextEmbedding]),
  ],
  providers: [
    SupabaseStorageService,
    VoiceService,
    OpenAIService,
    ReplicateService,
    PromptInjectionGuardService,
    EmbeddingService,
    ContextIndexerService,
  ],
  exports: [
    SupabaseStorageService,
    VoiceService,
    OpenAIService,
    ReplicateService,
    PromptInjectionGuardService,
    EmbeddingService,
    ContextIndexerService,
  ],
})
export class SharedModule {}











