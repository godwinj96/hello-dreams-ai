import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const start = Date.now();

    const requestId = req.headers['x-request-id'] as string;
    const { method, url } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(
            `${method} ${url} ${res.statusCode} ${ms}ms [${requestId ?? '-'}]`,
          );
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.warn(
            `${method} ${url} ERROR ${ms}ms [${requestId ?? '-'}]: ${err?.message}`,
          );
        },
      }),
    );
  }
}
