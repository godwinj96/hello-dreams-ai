import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  generateAiResponse(prompt: string): string {
    // Placeholder for AI response generation
    return `AI response for: ${prompt}`;
  }
}
