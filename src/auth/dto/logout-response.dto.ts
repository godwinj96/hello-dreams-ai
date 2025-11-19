import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Logged out successfully',
  })
  message: string;
}

