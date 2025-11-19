import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendCareerMessageDto {
  @ApiProperty({ description: 'Message content', example: 'I am interested in software engineering roles' })
  @IsNotEmpty()
  @IsString()
  content: string;
}

