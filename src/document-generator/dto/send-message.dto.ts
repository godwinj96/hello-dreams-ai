import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendDocumentMessageDto {
  @ApiProperty({ description: 'Message content', example: 'I am applying for the Software Engineer position at Tech Corp', maxLength: 10000 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(10000, { message: 'Message content must not exceed 10000 characters' })
  content: string;
}

