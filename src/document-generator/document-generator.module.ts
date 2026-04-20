import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentGeneratorController } from './document-generator.controller';
import { DocumentGeneratorServiceMain } from './document-generator.service';
import { DocumentGeneratorService } from './services/document-generator.service';
import { CoverLetterGeneratorService } from './services/cover-letter-generator.service';
import { JobDescriptionParserService } from './services/job-description-parser.service';
import { DocumentConversation } from './entities/document-conversation.entity';
import { DocumentMessage } from './entities/document-message.entity';
import { Document } from './entities/document.entity';
import { AiChatService } from '../resume-builder/services/ai-chat.service';
import { ResumeBuilderModule } from '../resume-builder/resume-builder.module';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';
import { CreditsModule } from '../credits/credits.module';
import { ResumeData } from '../resume-builder/entities/resume-data.entity';
import { Resume } from '../resume-builder/entities/resume.entity';
import { UserContextService } from './services/user-context.service';
import { UserContextEmbedding } from '../shared/entities/user-context-embedding.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentConversation,
      DocumentMessage,
      Document,
      ResumeData,
      Resume,
      UserContextEmbedding,
    ]),
    ResumeBuilderModule,
    ProfessionalProfileModule,
    SharedModule,
    AdminModule,
    CreditsModule,
  ],
  controllers: [DocumentGeneratorController],
  providers: [
    DocumentGeneratorServiceMain,
    DocumentGeneratorService,
    CoverLetterGeneratorService,
    JobDescriptionParserService,
    UserContextService,
  ],
  exports: [DocumentGeneratorServiceMain],
})
export class DocumentGeneratorModule {}
