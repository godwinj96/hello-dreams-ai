import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum JobType {
  FullTime = 'full-time',
  PartTime = 'part-time',
  Contract = 'contract',
  Internship = 'internship',
}

export enum ExperienceLevel {
  Entry = 'entry',
  Mid = 'mid',
  Senior = 'senior',
}

export enum JobCountry {
  Nigeria = 'NG',
  Ghana = 'GH',
  Kenya = 'KE',
  SouthAfrica = 'ZA',
  Global = 'global',
}

export class SearchJobsDto {
  @ApiProperty({
    description: 'Job title, keywords, or skills',
    required: false,
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({
    description: 'City or region (e.g. Lagos, Remote)',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    enum: JobCountry,
    required: false,
    default: JobCountry.Nigeria,
  })
  @IsOptional()
  @IsEnum(JobCountry)
  country?: JobCountry = JobCountry.Nigeria;

  @ApiProperty({ enum: JobType, required: false })
  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @ApiProperty({ enum: ExperienceLevel, required: false })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiProperty({ description: 'Remote jobs only', required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  remote?: boolean;

  @ApiProperty({ minimum: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ minimum: 1, maximum: 50, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
