import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../enums/document-type.enum';

export class CreateDocumentConversationDto {
  @ApiProperty({
    description: 'Conversation title',
    required: false,
    example: 'Cover Letter for Software Engineer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @ApiProperty({
    description: 'Type of document to generate',
    enum: DocumentType,
    example: DocumentType.CoverLetter,
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: 'Target job title',
    required: false,
    example: 'Software Engineer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'Target job title must not exceed 200 characters',
  })
  targetJobTitle?: string;

  @ApiProperty({
    description: 'Target company name',
    required: false,
    example: 'Tech Corp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'Target company name must not exceed 200 characters',
  })
  targetCompany?: string;

  @ApiProperty({
    description: 'Job description',
    required: false,
    example: 'We are looking for...',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000, {
    message: 'Job description must not exceed 50000 characters',
  })
  jobDescription?: string;
}
