import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  IsNotEmpty,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InlineJobDataDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() company?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() location?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() salary?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() jobType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isRemote?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() country?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() source?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() sourceUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() externalId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() experienceLevel?: string;
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() atsType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() atsBoardToken?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() atsJobId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() applicationUrl?: string;
}

export class CreateApplicationDto {
  @ApiProperty({ description: 'ID of an existing cached job listing', required: false })
  @IsOptional()
  @IsUUID()
  jobListingId?: string;

  @ApiProperty({ description: 'Inline job data when saving directly from external search', required: false, type: InlineJobDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineJobDataDto)
  jobData?: InlineJobDataDto;

  @ApiProperty({ required: false, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
