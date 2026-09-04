import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RefreshTokenService } from './refresh-token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../users/enums/role.enum';
import { UsageTrackingService } from '../admin/services/usage-tracking.service';
import { DashboardEventService } from '../admin/services/dashboard-event.service';
import { EmailService } from '../shared/email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private refreshTokenService: RefreshTokenService,
    private configService: ConfigService,
    private usageTrackingService: UsageTrackingService,
    private dashboardEventService: DashboardEventService,
    private emailService: EmailService,
  ) {}

  private getFrontendUrl(): string {
    const origin = this.configService.get<string>('CORS_ORIGIN', '');
    const first = origin.split(',')[0]?.trim();
    return (
      this.configService.get<string>('FRONTEND_URL') ||
      first ||
      'http://localhost:5173'
    );
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

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

    this.sendVerificationEmail(user).catch((err) =>
      console.error('Failed to send verification email:', err),
    );

    return this.generateTokens(user);
  }

  private async sendVerificationEmail(user: {
    id: string;
    email: string;
    name: string;
  }): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const hashed = this.hashToken(token);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.updateAuthTokens(user.id, {
      emailVerificationToken: hashed,
      emailVerificationExpires: expires,
    });

    const link = `${this.getFrontendUrl()}/auth/verify-email?token=${token}`;
    await this.emailService.sendEmail(
      user.email,
      'Verify your Hello Dreams AI account',
      `<p>Hi ${user.name},</p><p><a href="${link}">Verify your email</a></p>`,
    );
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const hashed = this.hashToken(token);
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await this.usersService.updateAuthTokens(user.id, {
        passwordResetToken: hashed,
        passwordResetExpires: expires,
      });
      const link = `${this.getFrontendUrl()}/reset-password?token=${token}`;
      await this.emailService.sendEmail(
        user.email,
        'Reset your Hello Dreams AI password',
        `<p>Hi ${user.name},</p><p><a href="${link}">Reset your password</a></p><p>This link expires in 1 hour.</p>`,
      );
    }
    return {
      message:
        'If an account exists for this email, a reset link has been sent.',
    };
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const hashed = this.hashToken(token);
    const user = await this.usersService.findByPasswordResetToken(hashed);
    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
    await this.usersService.updateAuthTokens(user.id, {
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const hashed = this.hashToken(token);
    const user = await this.usersService.findByEmailVerificationToken(hashed);
    if (
      !user ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.updateAuthTokens(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user && !user.emailVerified) {
      await this.sendVerificationEmail(user);
    }
    return {
      message: 'If your account is unverified, a new email has been sent.',
    };
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
