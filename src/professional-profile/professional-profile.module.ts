import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessionalProfile } from './entities/professional-profile.entity';
import { ProfessionalProfileService } from './professional-profile.service';
import { ProfessionalProfileController } from './professional-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProfessionalProfile])],
  controllers: [ProfessionalProfileController],
  providers: [ProfessionalProfileService],
  exports: [ProfessionalProfileService],
})
export class ProfessionalProfileModule {}

