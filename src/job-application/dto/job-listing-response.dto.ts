import { ApiProperty } from '@nestjs/swagger';

export class JobListingResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) externalId: string | null;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) company: string | null;
  @ApiProperty({ nullable: true }) location: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) salary: string | null;
  @ApiProperty({ nullable: true }) jobType: string | null;
  @ApiProperty({ nullable: true, type: [String] }) skills: string[] | null;
  @ApiProperty({ nullable: true }) experienceLevel: string | null;
  @ApiProperty({ nullable: true }) source: string | null;
  @ApiProperty({ nullable: true }) sourceUrl: string | null;
  @ApiProperty({ nullable: true }) applicationUrl: string | null;
  @ApiProperty({ nullable: true }) postedDate: Date | null;
  @ApiProperty({ nullable: true }) matchScore: number | null;
  @ApiProperty() isRemote: boolean;
  @ApiProperty({ nullable: true }) country: string | null;
  @ApiProperty({ nullable: true }) atsType: string | null;
  @ApiProperty() createdAt: Date;
}
