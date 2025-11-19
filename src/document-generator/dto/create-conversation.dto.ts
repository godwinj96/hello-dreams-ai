import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../enums/document-type.enum';

export class CreateDocumentConversationDto {
  @ApiProperty({ description: 'Conversation title', required: false, example: 'Cover Letter for Software Engineer' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Type of document to generate', enum: DocumentType, example: DocumentType.CoverLetter })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ description: 'Target job title', required: false, example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @ApiProperty({ description: 'Target company name', required: false, example: 'Tech Corp' })
  @IsOptional()
  @IsString()
  targetCompany?: string;

  @ApiProperty({ description: 'Job description', required: false, example: 'We are looking for...' })
  @IsOptional()
  @IsString()
  jobDescription?: string;
}

