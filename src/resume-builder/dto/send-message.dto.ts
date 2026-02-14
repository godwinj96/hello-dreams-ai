import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendResumeMessageDto {
  @ApiProperty({ description: 'Message content', example: 'I have 5 years of experience in software development', maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000, { message: 'Message content must not exceed 10000 characters' })
  content: string;
}

