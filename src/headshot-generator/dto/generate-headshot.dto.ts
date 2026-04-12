import { IsEnum, IsOptional, IsUrl, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HeadshotStyle, HeadshotPersonaType } from '../entities/headshot-generation.entity';

/** Short persona names the frontend may send → full enum values the backend uses */
const PERSONA_ALIAS_MAP: Record<string, HeadshotPersonaType> = {
  'confident': HeadshotPersonaType.ConfidentLeader,
  'approachable': HeadshotPersonaType.ApproachableExpert,
  'innovative': HeadshotPersonaType.InnovativeThinker,
  'trustworthy': HeadshotPersonaType.TrustworthyProfessional,
};

export class GenerateHeadshotDto {
  /**
   * Frontend alias: some versions send the upload URL under `imageId` rather
   * than `originalImageUrl`. Declaring it here prevents the global
   * `forbidNonWhitelisted` pipe from rejecting the request; the transform on
   * `originalImageUrl` then copies the value across.
   */
  @ApiPropertyOptional({ description: 'Alias for originalImageUrl (legacy frontend field)', deprecated: true })
  @IsOptional()
  @IsString()
  imageId?: string;

  @ApiProperty({
    description: 'URL of the uploaded reference image (from the upload endpoint)',
    example: 'https://cqdqicqzdhccuylzpyvn.supabase.co/storage/v1/object/sign/headshot-originals/headshots/original/user-id/image.jpg',
  })
  @Transform(({ obj }) => obj.originalImageUrl ?? obj.imageId)
  @IsUrl()
  originalImageUrl: string;

  @ApiProperty({
    description: 'Professional headshot style',
    enum: HeadshotStyle,
    example: HeadshotStyle.Corporate,
  })
  @IsEnum(HeadshotStyle)
  style: HeadshotStyle;

  /**
   * Frontend alias: some versions send `persona` (short name like "confident")
   * instead of `personaType` (full value like "confident-leader"). The transform
   * normalises both short and full names.
   */
  @ApiPropertyOptional({ description: 'Alias for personaType (legacy frontend field)', deprecated: true })
  @IsOptional()
  @IsString()
  persona?: string;

  @ApiPropertyOptional({
    description: 'Professional persona type. Defaults to profile persona or trustworthy-professional.',
    enum: HeadshotPersonaType,
    example: HeadshotPersonaType.ConfidentLeader,
  })
  @Transform(({ obj }) => {
    const raw = obj.personaType ?? obj.persona;
    if (!raw) return raw;
    // Normalize short frontend names ("confident") → full enum values ("confident-leader")
    return PERSONA_ALIAS_MAP[raw] ?? raw;
  })
  @IsOptional()
  @IsEnum(HeadshotPersonaType)
  personaType?: HeadshotPersonaType;
}
