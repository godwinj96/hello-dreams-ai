import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendResumeMessageDto {
  @ApiProperty({ description: 'Message content', example: 'I have 5 years of experience in software development' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

