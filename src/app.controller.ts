import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { Roles } from './auth/decorators/roles.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Role } from './users/enums/role.enum';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Post('ai')
  generateAiResponse(@Body() body: { prompt: string }): string {
    return this.appService.generateAiResponse(body.prompt);
  }

  @Get('user-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User, Role.Admin)
  getUserOnlyRoute(@Request() req) {
    return {
      message: 'This route is accessible to authenticated users',
      user: req.user,
    };
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  getAdminOnlyRoute(@Request() req) {
    return {
      message: 'This route is accessible only to admins',
      user: req.user,
    };
  }
}
