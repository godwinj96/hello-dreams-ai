import { IsEnum, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HeadshotStyle, HeadshotPersonaType } from '../entities/headshot-generation.entity';

export class GenerateHeadshotDto {
  @ApiProperty({
    description: 'URL of the uploaded reference image (from the upload endpoint)',
    example: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
  })
  @IsUrl()
  originalImageUrl: string;

  @ApiProperty({
    description: 'Professional headshot style',
    enum: HeadshotStyle,
    example: HeadshotStyle.Corporate,
  })
  @IsEnum(HeadshotStyle)
  style: HeadshotStyle;

  @ApiPropertyOptional({
    description: 'Professional persona type. Defaults to profile persona or trustworthy-professional.',
    enum: HeadshotPersonaType,
    example: HeadshotPersonaType.ConfidentLeader,
  })
  @IsOptional()
  @IsEnum(HeadshotPersonaType)
  personaType?: HeadshotPersonaType;
}
