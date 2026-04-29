import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { JobApplicationStatus } from '../entities/job-application.entity';

export class UpdateApplicationDto {
  @ApiProperty({ enum: JobApplicationStatus, required: false })
  @IsOptional()
  @IsEnum(JobApplicationStatus)
  status?: JobApplicationStatus;

  @ApiProperty({ required: false, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
