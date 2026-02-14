import { ApiProperty } from '@nestjs/swagger';
import { HeadshotStyle, HeadshotPersonaType } from '../entities/headshot-generation.entity';

export class UploadImageResponseDto {
  @ApiProperty({ description: 'Uploaded image URL', example: 'https://...' })
  imageUrl: string;
}

export class GenerateHeadshotDto {
  @ApiProperty({ description: 'Original image URL', example: 'https://...' })
  originalImageUrl: string;

  @ApiProperty({ description: 'Headshot style', enum: HeadshotStyle, example: HeadshotStyle.Corporate })
  style: HeadshotStyle;

  @ApiProperty({ description: 'Persona type', enum: HeadshotPersonaType, required: false, example: HeadshotPersonaType.ConfidentLeader })
  personaType?: HeadshotPersonaType;
}













