import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: any,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Respect X-Forwarded-For header if behind proxy
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Public routes are still throttled — they just skip JWT auth, not rate limiting.
    // This ensures login/register remain protected against brute-force.
    return super.canActivate(context);
  }
}

