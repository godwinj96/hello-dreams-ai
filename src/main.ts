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
        'http://localhost:5174',
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
      `# Hello Dreams AI - Career Preparation Platform API

Complete API documentation for the Hello Dreams AI platform. This API enables frontend applications to build comprehensive career preparation tools including resume building, professional headshot generation, document creation, and more.

## 🔐 Authentication Flow

All protected endpoints require JWT authentication. Follow these steps:

1. **Register or Login**: 
   - \`POST /auth/register\` - Create a new account
   - \`POST /auth/login\` - Authenticate with email/password
   - \`GET /auth/google\` - OAuth authentication via Google

2. **Receive Tokens**: 
   - Response includes \`access_token\` and \`refresh_token\`
   - Access tokens expire after a set period
   - Refresh tokens can be used to obtain new access tokens

3. **Use Access Token**: 
   - Include in \`Authorization\` header: \`Bearer <access_token>\`
   - All protected endpoints require this header

4. **Refresh Token**: 
   - Use \`POST /auth/refresh\` when access token expires
   - Use \`POST /auth/logout\` to revoke refresh token

## 📋 Module Workflows

### 1. Headshot Generator (Priority Module)

**Complete Workflow:**
1. **Upload Original Image**: 
   - \`POST /headshot-generator/upload\` (multipart/form-data, field: \`image\`)
   - Returns: \`{ imageUrl: string }\` - Save this \`originalImageUrl\`

2. **Generate Headshots**: 
   - \`POST /headshot-generator/generate\`
   - Body: \`{ originalImageUrl: string, style: HeadshotStyle, personaType?: HeadshotPersonaType }\`
   - **Styles**: \`corporate\`, \`modern\`, \`executive\`, \`creative\`
   - **Personas**: \`confident-leader\`, \`approachable-expert\`, \`innovative-thinker\`, \`trustworthy-professional\`
   - Returns: \`HeadshotGeneration\` object with \`generatedImages\` array (4 URLs by default)
   - **Provider Fallback**: OpenAI (images.edit) → Gemini 2.5 Flash → HuggingFace (image-to-image)

3. **Retrieve Results**: 
   - \`GET /headshot-generator/generations/:id\` - Get specific generation
   - \`GET /headshot-generator/generations\` - List all user's generations

**Status Values**: \`pending\`, \`processing\`, \`completed\`, \`failed\`

### 2. Resume Builder

**Workflow:**
1. **Create Conversation**: \`POST /resume-builder/conversations\`
   - Body: \`{ targetJobTitle?: string, targetIndustry?: string }\`
   - Returns conversation ID

2. **Send Messages**: \`POST /resume-builder/conversations/:id/messages\`
   - Body: \`{ content: string }\`
   - AI responds with resume suggestions and questions
   - Continue conversation to refine resume content

3. **Generate Resume**: \`POST /resume-builder/conversations/:id/generate\`
   - Creates structured resume JSON from conversation
   - Returns: \`ResumeResponseDto\` with \`content\` object

4. **Manage Resume**: 
   - \`GET /resume-builder/conversations/:id/resume\` - Retrieve resume
   - \`PUT /resume-builder/conversations/:id/resume\` - Replace entire resume
   - \`PATCH /resume-builder/conversations/:id/resume\` - Partial update
   - \`DELETE /resume-builder/conversations/:id/resume\` - Delete resume

5. **List Conversations**: 
   - \`GET /resume-builder/conversations?page=1&limit=10\` - Paginated list
   - \`GET /resume-builder/conversations/:id?page=1&limit=10\` - Get with paginated messages

### 3. Document Generator (Cover Letters & Personal Statements)

**Workflow:**
1. **Create Conversation**: \`POST /document-generator/conversations\`
   - Body: \`{ documentType: 'coverLetter' | 'personalStatement', targetJobTitle?: string, targetCompany?: string }\`
   - Returns conversation ID

2. **Iterate Content**: \`POST /document-generator/conversations/:id/messages\`
   - Send prompts to refine document content
   - AI provides suggestions and edits

3. **Generate Document**: \`POST /document-generator/conversations/:id/generate\`
   - Generates final document from conversation
   - Persists to database
   - Returns: \`DocumentResponseDto\` with structured content

4. **Manage Document**: 
   - \`GET /document-generator/conversations/:id/document\` - Read document
   - \`PUT /document-generator/conversations/:id/document\` - Replace document
   - \`PATCH /document-generator/conversations/:id/document\` - Partial update
   - \`DELETE /document-generator/conversations/:id/document\` - Delete document

### 4. Career Profile Discovery

**Workflow:**
1. **Create Conversation**: \`POST /career-profile/conversations\`
   - Body: \`{ initialContext?: string }\`
   - Returns conversation ID

2. **Optional: Upload CV**: \`POST /career-profile/conversations/:id/upload-cv\`
   - Multipart form-data with \`file\` field (PDF or DOCX)
   - Parses CV and adds to conversation context

3. **Send Messages**: \`POST /career-profile/conversations/:id/messages\`
   - Ask career questions, get AI insights
   - **Voice Messages**: \`POST /career-profile/conversations/:id/voice-message\`
     - Upload audio file (MP3, WAV) - automatically transcribed

4. **Get Summary**: \`GET /career-profile/conversations/:id/summary\`
   - Extracted profile summary from conversation

5. **Get Confirmation**: \`GET /career-profile/conversations/:id/confirmation\`
   - Review collected data before finalizing

### 5. Persona Builder

**Workflow:**
1. **Get Questions**: \`GET /persona-builder/questions\`
   - Returns questionnaire (managed on frontend)

2. **Submit Answers**: \`POST /persona-builder/answers\`
   - Body: \`{ answers: Array<{ questionId: string, answer: string }> }\`
   - Stores answers for persona generation

3. **Generate Persona**: \`POST /persona-builder/generate\`
   - Creates professional persona from answers
   - Returns: \`PersonaResponseDto\` with persona details

4. **Get Persona**: \`GET /persona-builder/persona\`
   - Retrieve generated persona

5. **Apply Persona**: \`POST /persona-builder/apply\`
   - Applies persona to user's profile (affects CV, cover letters, LinkedIn)

6. **Restart**: \`POST /persona-builder/restart\`
   - Clears answers and persona data

### 6. LinkedIn Optimization

**Workflow:**
1. **Generate Profile**: \`POST /linkedin-optimization/generate\`
   - Creates LinkedIn profile from resume data
   - Returns: \`LinkedInProfile\` object

2. **Get Profile**: \`GET /linkedin-optimization/profile\`
   - Retrieve current LinkedIn profile

3. **Update Sections**: 
   - \`PUT /linkedin-optimization/profile/:section\` - Update specific section
   - \`PUT /linkedin-optimization/profile\` - Replace entire profile
   - \`PATCH /linkedin-optimization/profile\` - Partial update

4. **Delete**: \`DELETE /linkedin-optimization/profile\`

### 7. Payments & Subscriptions

**One-Time Payment Flow:**
1. **Initialize**: \`POST /payments/initialize\`
   - Body: \`{ amount: number, currency?: string, metadata?: object }\`
   - Returns: \`{ authorizationUrl: string, payment: PaymentResponseDto }\`
   - Redirect user to \`authorizationUrl\`

2. **Webhook**: Paystack sends webhook to \`POST /payments/webhook\`
   - Automatically processes payment status

3. **History**: \`GET /payments/history\`
   - Get user's payment history

**Subscription Flow:**
1. **Initialize**: \`POST /payments/subscription/initialize\`
   - Body: \`{ billingCycle: 'monthly' | 'yearly', metadata?: object }\`
   - Returns authorization URL

2. **Get Subscription**: \`GET /payments/subscription\`
   - Current active subscription

3. **Cancel**: \`DELETE /payments/subscription/:id\`

### 8. User Management

- **Profile**: \`GET /users/profile\` - Current user profile
- **Update**: \`PUT /users/:id\` - Update user (self or admin)
- **Admin**: \`GET /users\` - List users (admin only, supports filters)
- **Stats**: \`GET /users/stats\` - User statistics (admin only)

### 9. Admin Dashboard

- **Stats**: \`GET /admin/dashboard/stats\` - Dashboard statistics
- **SSE Stream**: \`GET /admin/dashboard/stream\` - Real-time updates via Server-Sent Events
- **User Stats**: \`GET /admin/dashboard/users/:id/stats\` - Daily usage stats for user

## 🔄 Common Patterns

### Conversation-Based Modules
Most AI modules follow this pattern:
1. Create conversation → Get conversation ID
2. Send messages to conversation
3. Generate final output from conversation
4. Manage generated content (CRUD operations)

### Pagination
Many list endpoints support pagination:
- Query params: \`?page=1&limit=10\`
- Response includes metadata: \`{ data: [], meta: { page, limit, total, totalPages, hasNext, hasPrevious } }\`

### Error Handling
- **400**: Bad Request - Invalid input data
- **401**: Unauthorized - Missing or invalid token
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource doesn't exist
- **409**: Conflict - Resource already exists
- **413**: Payload Too Large - Request exceeds size limit

### Rate Limiting
- **Default**: 100 requests/minute
- **AI Generation**: 10 requests/hour
- **Chat/Messages**: 30 requests/hour
- **Public Endpoints**: 20 requests/minute

## 📝 Important Notes for the Frontend.

1. **Always create conversations first** before sending messages in AI modules
2. **Store conversation IDs** - you'll need them for subsequent requests
3. **Handle token refresh** - implement automatic token refresh on 401 errors
4. **File uploads** - Use \`multipart/form-data\` for file uploads
5. **Pagination** - Use pagination for large lists to improve performance
6. **Error responses** - Check \`statusCode\` and \`message\` fields in error responses
7. **Webhooks** - Payment webhooks are handled server-side, no frontend action needed`,
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
