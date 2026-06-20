import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendCareerMessageDto {
  @ApiProperty({
    description: 'Message content',
    example: 'I am interested in software engineering roles',
    maxLength: 10000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(10000, {
    message: 'Message content must not exceed 10000 characters',
  })
  content: string;
}
