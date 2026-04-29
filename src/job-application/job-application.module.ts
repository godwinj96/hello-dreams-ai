import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobApplicationController } from './job-application.controller';
import { JobApplicationService } from './job-application.service';
import { JobSearchService } from './services/job-search.service';
import { JobApplyService } from './services/job-apply.service';
import { JobDocumentGeneratorService } from './services/job-document-generator.service';
import { SerpApiAdapterService } from './services/serpapi-adapter.service';
import { CareerjetAdapterService } from './services/careerjet-adapter.service';
import { JSearchAdapterService } from './services/jsearch-adapter.service';
import { RemotiveAdapterService } from './services/remotive-adapter.service';
import { JobListing } from './entities/job-listing.entity';
import { JobApplication } from './entities/job-application.entity';
import { ResumeData } from '../resume-builder/entities/resume-data.entity';
import { Resume } from '../resume-builder/entities/resume.entity';
import { Document } from '../document-generator/entities/document.entity';
import { DocumentConversation } from '../document-generator/entities/document-conversation.entity';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobListing,
      JobApplication,
      Resume,
      ResumeData,
      Document,
      DocumentConversation,
    ]),
    SharedModule,
    AdminModule,
    CreditsModule,
  ],
  controllers: [JobApplicationController],
  providers: [
    JobApplicationService,
    JobSearchService,
    JobApplyService,
    JobDocumentGeneratorService,
    SerpApiAdapterService,
    CareerjetAdapterService,
    JSearchAdapterService,
    RemotiveAdapterService,
  ],
  exports: [JobApplicationService],
})
export class JobApplicationModule {}
