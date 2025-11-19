import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message or array of error messages',
    example: 'Bad Request',
    oneOf: [
      { type: 'string' },
      {
        type: 'array',
        items: { type: 'string' },
      },
    ],
  })
  message: string | string[];

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
    required: false,
  })
  error?: string;
}

