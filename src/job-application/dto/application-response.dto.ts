import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { JobApplicationStatus } from '../entities/job-application.entity';
import { JobListingResponseDto } from './job-listing-response.dto';

export class ApplicationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() jobListingId: string;
  @ApiProperty({ type: () => JobListingResponseDto, nullable: true })
  jobListing: JobListingResponseDto | null;
  @ApiProperty({ enum: JobApplicationStatus }) status: JobApplicationStatus;
  @ApiProperty({ nullable: true }) appliedAt: Date | null;
  @ApiProperty({ nullable: true }) customCvId: string | null;
  @ApiProperty({ nullable: true }) customCoverLetterId: string | null;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ nullable: true }) atsApplicationId: string | null;
  @ApiProperty({ nullable: true }) atsSubmittedAt: Date | null;
  @ApiProperty({
    description: 'True when both resume + cover letter have been generated',
    nullable: false,
  })
  hasGeneratedDocuments: boolean;
  @ApiProperty({ nullable: true }) generatedResumeContent: Record<
    string,
    any
  > | null;
  @ApiProperty({ nullable: true }) generatedCoverLetterContent: Record<
    string,
    any
  > | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ApplicationsFilterDto {
  @ApiProperty({ enum: JobApplicationStatus, required: false })
  @IsOptional()
  @IsEnum(JobApplicationStatus)
  status?: JobApplicationStatus;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
