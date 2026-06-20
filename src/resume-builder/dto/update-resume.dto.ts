import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateResumeDto {
  @ApiProperty({
    description: 'Structured resume JSON object',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  content: Record<string, any>;
}

export class PatchResumeDto {
  @ApiProperty({
    description: 'Partial structured resume JSON object to merge',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, any>;
}
