import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
    bodyParser: true,
  });
  const configService = app.get(ConfigService);

  // Apply security headers middleware globally
  app.use(new SecurityHeadersMiddleware().use.bind(new SecurityHeadersMiddleware()));

  // Configure request size limits
  app.use((req, res, next) => {
    // JSON body size limit: 1MB
    if (req.headers['content-type']?.includes('application/json')) {
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > 1024 * 1024) {
        return res.status(413).json({ message: 'Request entity too large' });
      }
    }
    next();
  });

  // CORS configuration
  const corsOrigins = configService.get<string>('CORS_ORIGIN');
  const allowedOrigins = corsOrigins
    ? corsOrigins.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:4200',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4200',
        'http://127.0.0.1:8080',
        'https://hello-dreams-ai.vercel.app',
      ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Hello Dreams AI API')
    .setDescription(
      `API documentation for Hello Dreams AI - Career preparation platform

## Getting Started
- Auth: \`POST /auth/register\` or \`POST /auth/login\` → use \`Authorization: Bearer <access_token>\` on all protected endpoints.
- Conversations: For AI modules, create a conversation first, then send messages to it.
  - Resume: \`POST /resume-builder/conversations\` → \`POST /resume-builder/conversations/:id/messages\`
  - Career: \`POST /career-profile/conversations\` → \`POST /career-profile/conversations/:id/messages\`
  - Documents: \`POST /document-generator/conversations\` → \`POST /document-generator/conversations/:id/messages\`

## Headshot Generator (/headshot-generator/generate)
1) Upload your photo: \`POST /headshot-generator/upload\` (multipart form, field \`image\`) → returns \`originalImageUrl\`.
2) Generate: \`POST /headshot-generator/generate\` with body \`{ originalImageUrl, style, personaType? }\`. Uses HuggingFace SDXL when configured, otherwise OpenAI Images. Generated headshots are stored and persisted.
3) Retrieve: \`GET /headshot-generator/generations/:id\` or list via \`GET /headshot-generator/generations\`.

## Document Generator (?generate & persistence)
Goal: generate and persist cover letters/personal statements.
1) Start a conversation: \`POST /document-generator/conversations\` (choose document type + context) → returns conversation ID.
2) Iterate content: \`POST /document-generator/conversations/:id/messages\` with prompts/edits to shape the document.
3) Generate or regenerate document: \`POST /document-generator/conversations/:id/generate\` — produces the current document content and persists it to storage linked to the conversation.
4) Access/persist data:
   - Read: \`GET /document-generator/conversations/:id/document\`
   - Replace: \`PUT /document-generator/conversations/:id/document\`
   - Patch: \`PATCH /document-generator/conversations/:id/document\`
   - Delete: \`DELETE /document-generator/conversations/:id/document\`
Documents remain available via these endpoints after generation.

## Module Quickstart
- Resume Builder: create conversation → send resume content/messages.
- Career Profile: create conversation → ask discovery/role-fit questions.
- Persona Builder: build professional persona via answers.
- Document Generator: see flow above for \`/generate\` and persistence.
- LinkedIn Optimization: optimize profile content via messages.
- Headshot Generator: upload photo → generate variations (HF SDXL preferred, OpenAI fallback).
- Job Application: manage and match applications.
- Auth/Users: register/login and manage user profiles.`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('resume-builder', 'Resume builder module')
    .addTag('career-profile', 'Career profile discovery module')
    .addTag('persona-builder', 'Professional persona builder module')
    .addTag(
      'document-generator',
      'Cover letter and personal statement generator',
    )
    .addTag('linkedin-optimization', 'LinkedIn profile optimization module')
    .addTag('headshot-generator', 'Professional headshot generation module')
    .addTag('job-application', 'Job application and matching module')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
