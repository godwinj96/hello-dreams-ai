import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to the Hello Dreams AI API. GO to /api-docs to see the API documentation';
  }
}
