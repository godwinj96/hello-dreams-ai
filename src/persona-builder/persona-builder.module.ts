import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonaBuilderController } from './persona-builder.controller';
import { PersonaBuilderService } from './persona-builder.service';
import { PersonaAnswer } from './entities/persona-answer.entity';
import { AiChatService } from '../resume-builder/services/ai-chat.service';
import { ResumeBuilderModule } from '../resume-builder/resume-builder.module';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PersonaAnswer]),
    ResumeBuilderModule,
    ProfessionalProfileModule,
  ],
  controllers: [PersonaBuilderController],
  providers: [PersonaBuilderService],
  exports: [PersonaBuilderService],
})
export class PersonaBuilderModule {}

