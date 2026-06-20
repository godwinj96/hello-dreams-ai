import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export class PromoteUserDto {
  @ApiProperty({
    description: 'Target role for the user',
    enum: Role,
    example: Role.Admin,
  })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
