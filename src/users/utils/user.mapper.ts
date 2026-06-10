import { User } from '../entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';

export function toUserResponseDto(user: User): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    avatar_url: user.avatar_url ?? undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toUserResponseDtos(users: User[]): UserResponseDto[] {
  return users.map(toUserResponseDto);
}
