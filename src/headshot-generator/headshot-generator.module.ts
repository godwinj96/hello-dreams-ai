import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeadshotGeneratorController } from './headshot-generator.controller';
import { HeadshotGeneratorService } from './headshot-generator.service';
import { HeadshotGenerationService } from './services/headshot-generation.service';
import { ImageGenerationService } from './services/image-generation.service';
import { HeadshotGeneration } from './entities/headshot-generation.entity';
import { SharedModule } from '../shared/shared.module';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';
import { AdminModule } from '../admin/admin.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HeadshotGeneration]),
    SharedModule,
    ProfessionalProfileModule,
    AdminModule,
    CreditsModule,
  ],
  controllers: [HeadshotGeneratorController],
  providers: [
    HeadshotGeneratorService,
    HeadshotGenerationService,
    ImageGenerationService,
  ],
  exports: [HeadshotGeneratorService],
})
export class HeadshotGeneratorModule {}
