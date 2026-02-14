import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * Decorator for AI generation endpoints (10 requests/hour)
 */
export const ThrottleAIGeneration = () =>
  applyDecorators(Throttle({ default: { limit: 10, ttl: 3600000 } }));

/**
 * Decorator for chat/message endpoints (30 requests/hour)
 */
export const ThrottleChat = () =>
  applyDecorators(Throttle({ default: { limit: 30, ttl: 3600000 } }));



