import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from =
      this.configService.get<string>('EMAIL_FROM') ||
      'Hello Dreams AI <noreply@hellodreams.ai>';

    if (!apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not set — email not sent to ${to}: ${subject}`,
      );
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Failed to send email: ${body}`);
      throw new Error('Failed to send email');
    }
  }
}
