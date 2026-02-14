import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AnswerDto {
  @ApiProperty({ description: 'Question ID', example: '1' })
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({ description: 'Selected option ID', example: '1a' })
  @IsString()
  @IsNotEmpty()
  optionId: string;

  @ApiProperty({ description: 'Question text', example: 'How would you describe your communication style?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Answer text (option text)', example: 'Wait to be asked' })
  @IsString()
  @IsNotEmpty()
  answer: string;
}

export class SubmitAnswersDto {
  @ApiProperty({ description: 'Array of question-answer pairs', type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

