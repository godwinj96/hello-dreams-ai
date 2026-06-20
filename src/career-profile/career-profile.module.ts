import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareerProfileController } from './career-profile.controller';
import { CareerProfileService } from './career-profile.service';
import { CareerProfileExtractorService } from './services/career-profile-extractor.service';
import { CvParserService } from './services/cv-parser.service';
import { CareerConversation } from './entities/career-conversation.entity';
import { CareerMessage } from './entities/career-message.entity';
import { AiChatService } from '../resume-builder/services/ai-chat.service';
import { ResumeBuilderModule } from '../resume-builder/resume-builder.module';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CareerConversation, CareerMessage]),
    ResumeBuilderModule,
    ProfessionalProfileModule,
    SharedModule,
    AdminModule,
    CreditsModule,
  ],
  controllers: [CareerProfileController],
  providers: [
    CareerProfileService,
    CareerProfileExtractorService,
    CvParserService,
  ],
  exports: [CareerProfileService],
})
export class CareerProfileModule {}
