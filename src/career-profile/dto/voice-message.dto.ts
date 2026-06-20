import { ApiProperty } from '@nestjs/swagger';
import { CareerMessageResponseDto } from './career-profile-response.dto';

export class VoiceMessageResponseDto extends CareerMessageResponseDto {
  @ApiProperty({
    description: 'Text-to-speech audio URL (if requested)',
    required: false,
  })
  audioUrl?: string;
}
