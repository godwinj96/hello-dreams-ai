import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HeadshotStyle, HeadshotPersonaType } from '../entities/headshot-generation.entity';

/** Short persona names the frontend may send → full enum values the backend uses */
export const PERSONA_ALIAS_MAP: Record<string, HeadshotPersonaType> = {
  'confident': HeadshotPersonaType.ConfidentLeader,
  'approachable': HeadshotPersonaType.ApproachableExpert,
  'innovative': HeadshotPersonaType.InnovativeThinker,
  'trustworthy': HeadshotPersonaType.TrustworthyProfessional,
};

export class GenerateHeadshotDto {
  /** Canonical field name */
  @ApiPropertyOptional({
    description: 'URL of the uploaded reference image (from the upload endpoint)',
    example: 'https://cqdqicqzdhccuylzpyvn.supabase.co/storage/v1/object/sign/headshot-originals/...',
  })
  @IsOptional()
  @IsString()
  originalImageUrl?: string;

  /** Legacy frontend alias for originalImageUrl */
  @ApiPropertyOptional({ description: 'Alias for originalImageUrl', deprecated: true })
  @IsOptional()
  @IsString()
  imageId?: string;

  @ApiProperty({ enum: HeadshotStyle, example: HeadshotStyle.Corporate })
  @IsEnum(HeadshotStyle)
  style: HeadshotStyle;

  /** Canonical field name (full enum value, e.g. "confident-leader") */
  @ApiPropertyOptional({ enum: HeadshotPersonaType, example: HeadshotPersonaType.ConfidentLeader })
  @IsOptional()
  @IsString()
  personaType?: string;

  /** Legacy frontend alias — short name e.g. "confident" */
  @ApiPropertyOptional({ description: 'Alias for personaType', deprecated: true })
  @IsOptional()
  @IsString()
  persona?: string;
}
