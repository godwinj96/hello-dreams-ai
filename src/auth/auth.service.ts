import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RefreshTokenService } from './refresh-token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../users/enums/role.enum';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private refreshTokenService: RefreshTokenService,
    private configService: ConfigService,
    private usageTrackingService: UsageTrackingService,
    private dashboardEventService: DashboardEventService,
  ) {}

  private async generateTokens(user: any) {
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.refreshTokenService.generateToken(
      user.id,
      parseInt(
        this.configService.get<string>('REFRESH_TOKEN_EXPIRATION_DAYS', '7'),
      ),
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      role: Role.User,
      isActive: true, // New users are active by default
    });

    // Track user registration
    this.usageTrackingService
      .trackAction(user.id, 'user_registered', 'auth', {
        email: user.email,
        role: user.role,
      })
      .catch((err) => console.error('Failed to track registration:', err));

    // Emit event for dashboard
    this.dashboardEventService.emitUserRegistered(user.id, user.email);

    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Track user login
    this.usageTrackingService
      .trackAction(user.id, 'user_login', 'auth')
      .catch((err) => console.error('Failed to track login:', err));

    return this.generateTokens(user);
  }

  async validateGoogleUser(user: any) {
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }
    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string) {
    const token = await this.refreshTokenService.validateToken(refreshToken);
    if (!token) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findOne(token.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Revoke the old refresh token (token rotation)
    await this.refreshTokenService.revokeToken(refreshToken);

    // Generate new tokens
    return this.generateTokens(user);
  }

  async logout(refreshToken: string) {
    await this.refreshTokenService.revokeToken(refreshToken);
    return { message: 'Logged out successfully' };
  }
}
