import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendDocumentMessageDto {
  @ApiProperty({ description: 'Message content', example: 'I am applying for the Software Engineer position at Tech Corp' })
  @IsNotEmpty()
  @IsString()
  content: string;
}

