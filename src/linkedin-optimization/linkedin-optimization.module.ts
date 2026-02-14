import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkedInOptimizationController } from './linkedin-optimization.controller';
import { LinkedInOptimizationService } from './linkedin-optimization.service';
import { LinkedInContentService } from './services/linkedin-content.service';
import { LinkedInProfile } from './entities/linkedin-profile.entity';
import { ResumeBuilderModule } from '../resume-builder/resume-builder.module';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';
import { ResumeData } from '../resume-builder/entities/resume-data.entity';
import { Resume } from '../resume-builder/entities/resume.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LinkedInProfile, Resume, ResumeData]),
    ResumeBuilderModule,
    ProfessionalProfileModule,
    SharedModule,
    AdminModule,
  ],
  controllers: [LinkedInOptimizationController],
  providers: [
    LinkedInOptimizationService,
    LinkedInContentService,
  ],
  exports: [LinkedInOptimizationService],
})
export class LinkedInOptimizationModule {}

