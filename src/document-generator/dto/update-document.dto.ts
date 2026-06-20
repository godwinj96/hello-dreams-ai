import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { DocumentType } from '../enums/document-type.enum';

export class UpdateDocumentDto {
  @ApiProperty({ enum: DocumentType, description: 'Document type' })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: 'Structured document JSON object',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  content: Record<string, any>;
}

export class PatchDocumentDto {
  @ApiProperty({
    enum: DocumentType,
    description: 'Document type',
    required: false,
  })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiProperty({
    description: 'Partial structured document JSON object',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, any>;
}
