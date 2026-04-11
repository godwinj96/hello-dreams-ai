import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { ErrorResponseDto } from './dto/error-response.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with email and password. Returns JWT access token and refresh token upon successful registration.\n\n**Important:** After registration, you will receive an `access_token` in the response. This token must be included in the `Authorization` header (format: `Bearer <access_token>`) for all protected API endpoints.',
  })
  @ApiBody({
    type: RegisterDto,
    description: 'User registration data',
    examples: {
      example1: {
        summary: 'Example registration',
        value: {
          email: 'user@example.com',
          password: 'SecurePassword123!',
          name: 'John Doe',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
    type: AuthResponseDto,
    example: {
      access_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refresh_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'user',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User with this email already exists',
    type: ErrorResponseDto,
    example: {
      statusCode: 409,
      message: 'User with this email already exists',
      error: 'Conflict',
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
    example: {
      statusCode: 400,
      message: [
        'email must be an email',
        'password must be longer than or equal to 6 characters',
        'name must be a string',
      ],
      error: 'Bad Request',
    },
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticates a user with email and password. Returns JWT access token and refresh token upon successful authentication.\n\n**Important:** After login, you will receive an `access_token` in the response. This token must be included in the `Authorization` header (format: `Bearer <access_token>`) for all protected API endpoints.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'User login credentials',
    examples: {
      example1: {
        summary: 'Example login',
        value: {
          email: 'user@example.com',
          password: 'SecurePassword123!',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully authenticated',
    type: AuthResponseDto,
    example: {
      access_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refresh_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'user',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
    type: ErrorResponseDto,
    example: {
      statusCode: 401,
      message: 'Invalid credentials',
      error: 'Unauthorized',
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
    example: {
      statusCode: 400,
      message: ['email must be an email', 'password must be a string'],
      error: 'Bad Request',
    },
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchanges a valid refresh token for a new access token and refresh token. The old refresh token is revoked (token rotation).',
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token',
    examples: {
      example1: {
        summary: 'Example refresh token',
        value: {
          refresh_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens successfully refreshed',
    type: AuthResponseDto,
    example: {
      access_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refresh_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'user',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
    type: ErrorResponseDto,
    example: {
      statusCode: 401,
      message: 'Invalid or expired refresh token',
      error: 'Unauthorized',
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
    example: {
      statusCode: 400,
      message: ['refresh_token must be a string'],
      error: 'Bad Request',
    },
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @Public()
  @Post('logout')
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Revokes the provided refresh token, effectively logging out the user. The refresh token can no longer be used to obtain new access tokens.',
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token to revoke',
    examples: {
      example1: {
        summary: 'Example logout',
        value: {
          refresh_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged out',
    type: LogoutResponseDto,
    example: {
      message: 'Logged out successfully',
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
    example: {
      statusCode: 400,
      message: ['refresh_token must be a string'],
      error: 'Bad Request',
    },
  })
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(refreshTokenDto.refresh_token);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Initiate Google OAuth authentication',
    description:
      'Redirects the user to Google OAuth consent screen. This endpoint initiates the OAuth 2.0 flow for Google authentication.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to Google OAuth consent screen',
  })
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Callback endpoint for Google OAuth. This endpoint is called by Google after user authentication. Returns JWT access token and refresh token.\n\n**Important:** After authentication, you will receive an `access_token` in the response. This token must be included in the `Authorization` header (format: `Bearer <access_token>`) for all protected API endpoints.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully authenticated via Google',
    type: AuthResponseDto,
    example: {
      access_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refresh_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@gmail.com',
        name: 'John Doe',
        role: 'user',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Google authentication failed',
    type: ErrorResponseDto,
    example: {
      statusCode: 401,
      message: 'Authentication failed',
      error: 'Unauthorized',
    },
  })
  async googleAuthRedirect(@Request() req, @Res() res: Response) {
    const result = await this.authService.validateGoogleUser(req.user);
    // In a real app, you might want to redirect to frontend with token
    // For now, returning JSON response
    res.json(result);
  }
}
