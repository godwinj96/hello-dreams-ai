import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonaBuilderController } from './persona-builder.controller';
import { PersonaBuilderService } from './persona-builder.service';
import { PersonaAnswer } from './entities/persona-answer.entity';
import { PersonaScoringService } from './services/persona-scoring.service';
import { PersonaContentService } from './services/persona-content.service';
import { PersonaAiService } from './services/persona-ai.service';
import { ResumeBuilderModule } from '../resume-builder/resume-builder.module';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';
import { AdminModule } from '../admin/admin.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PersonaAnswer]),
    ProfessionalProfileModule,
    AdminModule,
    CreditsModule,
    ResumeBuilderModule,
  ],
  controllers: [PersonaBuilderController],
  providers: [
    PersonaBuilderService,
    PersonaScoringService,
    PersonaContentService,
    PersonaAiService,
  ],
  exports: [PersonaBuilderService],
})
export class PersonaBuilderModule {}
