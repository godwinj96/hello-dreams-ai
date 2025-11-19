import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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

**1. Authentication Flow:**
- Register a new account using \`POST /auth/register\` or login with \`POST /auth/login\`
- Both endpoints return an \`access_token\` and \`refresh_token\` in the response
- **Important:** You must include the \`access_token\` in the Authorization header for all protected endpoints
- Format: \`Authorization: Bearer <access_token>\`

**2. Conversation Flow:**
- Before sending messages to any AI module (resume-builder, career-profile, document-generator), you must first create a conversation
- Create a conversation by sending a \`POST\` request to the module's \`/conversations\` endpoint:
  - Resume Builder: \`POST /resume-builder/conversations\`
  - Career Profile: \`POST /career-profile/conversations\`
  - Document Generator: \`POST /document-generator/conversations\`
- Once you have a conversation ID, you can send messages to \`POST /<module>/conversations/:id/messages\`

**3. Example Flow:**
1. Register/Login → Get access token
2. Set Authorization header: \`Authorization: Bearer <access_token>\`
3. Create conversation → Get conversation ID
4. Send messages to the conversation using the conversation ID`,
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
