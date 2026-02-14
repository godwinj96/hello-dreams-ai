import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export class CreateAdminDto {
  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Admin password (minimum 6 characters)',
    example: 'SecurePassword123!',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Admin full name',
    example: 'Admin User',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Role for the user (admin or superuser). Defaults to admin.',
    enum: Role,
    example: Role.Admin,
    required: false,
    default: Role.Admin,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}


