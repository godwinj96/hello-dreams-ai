import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * Decorator for AI generation endpoints (10 requests/hour)
 */
export const ThrottleAIGeneration = () =>
  applyDecorators(Throttle({ default: { limit: 10, ttl: 3600000 } }));

/**
 * Decorator for chat/message endpoints (20 requests/minute)
 */
export const ThrottleChat = () =>
  applyDecorators(Throttle({ default: { limit: 20, ttl: 60000 } }));
