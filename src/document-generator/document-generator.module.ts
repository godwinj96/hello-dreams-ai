import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentGeneratorController } from './document-generator.controller';
import { DocumentGeneratorServiceMain } from './document-generator.service';
import { DocumentGeneratorService } from './services/document-generator.service';
import { DocumentConversation } from './entities/document-conversation.entity';
import { DocumentMessage } from './entities/document-message.entity';
import { Document } from './entities/document.entity';
import { AiChatService } from '../resume-builder/services/ai-chat.service';
import { ResumeBuilderModule } from '../resume-builder/resume-builder.module';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentConversation,
      DocumentMessage,
      Document,
    ]),
    ResumeBuilderModule,
    ProfessionalProfileModule,
  ],
  controllers: [DocumentGeneratorController],
  providers: [
    DocumentGeneratorServiceMain,
    DocumentGeneratorService,
  ],
  exports: [DocumentGeneratorServiceMain],
})
export class DocumentGeneratorModule {}

