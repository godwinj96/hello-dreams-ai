import { ApiProperty } from '@nestjs/swagger';

export class ApplyJobResponseDto {
  @ApiProperty({ enum: ['api', 'redirect'] })
  method: 'api' | 'redirect';

  @ApiProperty({ nullable: true, description: 'URL to open when method is redirect' })
  applyUrl?: string;

  @ApiProperty({ nullable: true, description: 'ATS application ID returned by Greenhouse or Lever' })
  atsApplicationId?: string;

  @ApiProperty({ description: 'Updated application status' })
  status: string;
}
