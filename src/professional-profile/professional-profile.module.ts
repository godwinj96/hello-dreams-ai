import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessionalProfile } from './entities/professional-profile.entity';
import { ProfessionalProfileService } from './professional-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProfessionalProfile])],
  providers: [ProfessionalProfileService],
  exports: [ProfessionalProfileService],
})
export class ProfessionalProfileModule {}

