import { ApiProperty } from '@nestjs/swagger';
import { HeadshotStyle, HeadshotPersonaType } from '../entities/headshot-generation.entity';

export class UploadImageResponseDto {
  @ApiProperty({
    description: 'URL of the uploaded image. Save this for use in the generate endpoint.',
    example: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
  })
  imageUrl: string;
}

export class GenerateHeadshotDto {
  @ApiProperty({
    description: 'Original image URL from the upload endpoint. Must be a valid Supabase storage URL.',
    example: 'https://supabase.co/storage/v1/object/public/headshot-originals/user-id/image.jpg',
  })
  originalImageUrl: string;

  @ApiProperty({
    description: 'Professional headshot style',
    enum: HeadshotStyle,
    example: HeadshotStyle.Corporate,
    enumName: 'HeadshotStyle',
  })
  style: HeadshotStyle;

  @ApiProperty({
    description: 'Professional persona type. Optional - will use profile persona or default to trustworthy-professional if not provided.',
    enum: HeadshotPersonaType,
    required: false,
    example: HeadshotPersonaType.ConfidentLeader,
    enumName: 'HeadshotPersonaType',
  })
  personaType?: HeadshotPersonaType;
}













