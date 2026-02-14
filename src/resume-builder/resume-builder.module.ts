import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResumeBuilderController } from './resume-builder.controller';
import { ResumeBuilderService } from './resume-builder.service';
import { AiChatService } from './services/ai-chat.service';
import { ResumeGeneratorService } from './services/resume-generator.service';
import { OpenAIService } from '../shared/services/openai.service';
import { ResumeConversation } from './entities/resume-conversation.entity';
import { ResumeMessage } from './entities/resume-message.entity';
import { Resume } from './entities/resume.entity';
import { ResumeData } from './entities/resume-data.entity';
import { UserContextEmbedding } from '../shared/entities/user-context-embedding.entity';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResumeConversation,
      ResumeMessage,
      Resume,
      ResumeData,
      UserContextEmbedding,
    ]),
    ProfessionalProfileModule,
    SharedModule,
    AdminModule,
  ],
  controllers: [ResumeBuilderController],
  providers: [ResumeBuilderService, AiChatService, ResumeGeneratorService],
  exports: [ResumeBuilderService, AiChatService],
})
export class ResumeBuilderModule {}
