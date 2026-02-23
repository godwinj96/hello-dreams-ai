# Security Checklist

This document outlines the security measures and best practices implemented in the Hello Dreams AI backend application.

## 1. Rate Limiting

### Implementation
- **Package**: `@nestjs/throttler`
- **Configuration**: Per-endpoint rate limits configured in `src/app.module.ts`

### Rate Limits
- **AI Generation Endpoints** (document/resume generation): 10 requests/hour
  - Applied to: `POST /document-generator/conversations/:id/generate`
  - Applied to: `POST /resume-builder/conversations/:id/generate`
- **Chat/Message Endpoints**: 30 requests/hour
  - Applied to: `POST /document-generator/conversations/:id/messages`
  - Applied to: `POST /resume-builder/conversations/:id/messages`
- **Standard CRUD Endpoints**: 100 requests/minute
  - Default limit for all other authenticated endpoints
- **Public Endpoints**: 20 requests/minute
  - Applied to routes marked with `@Public()` decorator

### Features
- Custom `ThrottlerBehindProxyGuard` respects `X-Forwarded-For` header for proxy environments
- Public routes are automatically excluded from rate limiting
- Rate limit headers included in responses

## 2. Security Headers

### Implementation
- **Middleware**: `src/common/middleware/security-headers.middleware.ts`
- **Applied**: Globally in `src/main.ts`

### Headers Implemented
- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking attacks
- **X-XSS-Protection**: `1; mode=block` - Enables XSS protection for legacy browsers
- **Strict-Transport-Security**: `max-age=31536000; includeSubDomains; preload` - HSTS (production only)
- **Content-Security-Policy**: Restricts resource loading to prevent XSS
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information
- **Permissions-Policy**: Restricts browser features (geolocation, microphone, camera)

## 3. Input Validation

### Implementation
- **Package**: `class-validator` (already in use)
- **Configuration**: Global `ValidationPipe` in `src/main.ts` with:
  - `whitelist: true` - Strips non-whitelisted properties
  - `forbidNonWhitelisted: true` - Rejects requests with non-whitelisted properties
  - `transform: true` - Automatically transforms payloads to DTO instances

### Validation Rules
- **String Length Limits**:
  - Message content: Max 10,000 characters
  - Conversation title: Max 200 characters
  - Job title/company: Max 200 characters
  - Job description: Max 50,000 characters
- **Type Validation**: All DTOs use `@IsString()`, `@IsEnum()`, `@IsOptional()`, etc.
- **Format Validation**: Email, UUID formats validated where applicable

## 4. Request Size Limits

### Implementation
- **Location**: `src/main.ts`
- **Limits**:
  - JSON body: 1MB maximum
  - File uploads: 10MB maximum (configurable per endpoint)

### Enforcement
- Middleware checks `Content-Length` header before processing
- Returns `413 Request Entity Too Large` for oversized requests

## 5. Prompt Injection Prevention

### Implementation
- **Service**: `src/shared/services/prompt-injection-guard.service.ts`
- **Integration**: Applied in:
  - `src/resume-builder/services/ai-chat.service.ts`
  - `src/shared/services/openai.service.ts`
  - `src/document-generator/services/cover-letter-generator.service.ts`

### Detection Patterns
The guard detects common jailbreak patterns:
- Instruction overrides: "ignore previous instructions", "forget all prompts"
- Role-playing attempts: "act as", "pretend to be", "you are now"
- System prompt markers: "system:", "### system:", "[system]"
- Prompt extraction: "show me your system prompt", "what are your instructions"
- Token manipulation: "repeat word X times"
- Encoding attempts: base64, hex, unicode, rot13
- Jailbreak techniques: "jailbreak", "dan mode", "developer mode"

### Sanitization
- Escapes special characters that could break prompt structure
- Removes suspicious markers and delimiters
- Trims excessive newlines
- Logs suspicious attempts for monitoring

### Safe Prompt Templates
- Clear boundaries between system instructions and user input
- Explicit markers: `---USER INPUT START---` / `---USER INPUT END---`
- Never concatenates user input directly into system prompts

## 6. SQL Injection Prevention

### Implementation
- **ORM**: TypeORM with parameterized queries
- **Best Practice**: All database queries use TypeORM's query builder or repository methods
- **No Raw Queries**: Avoids string concatenation in SQL queries

### Protection
- TypeORM automatically escapes parameters
- Prepared statements used for all database operations
- Entity-based queries prevent injection attacks

## 7. Authentication & Authorization

### Implementation
- **Strategy**: JWT-based authentication
- **Guards**: 
  - `JwtAuthGuard` - Validates JWT tokens
  - `RolesGuard` - Enforces role-based access control
- **Public Routes**: Marked with `@Public()` decorator

### Features
- Token validation on all protected routes
- User account status checking (active/inactive)
- Role-based access control (User, Admin, Superuser)
- Refresh token mechanism for token rotation

## 8. Data Encryption

### At Rest
- Database credentials stored in environment variables
- Sensitive data (passwords) hashed using bcrypt
- API keys stored in environment variables, never in code

### In Transit
- HTTPS enforced in production (HSTS header)
- TLS/SSL for all API communications
- Secure cookie settings for authentication

## 9. API Key Management

### Best Practices
- All API keys stored in environment variables
- Never committed to version control
- Separate keys for different environments (dev, staging, production)
- Regular rotation recommended

### Keys Used
- `OPENAI_API_KEY` - OpenAI API access
- `HUGGINGFACE_API_KEY` - HuggingFace API access
- `JWT_SECRET` - JWT token signing
- `DATABASE_URL` - Database connection string

## 10. Logging and Monitoring

### Recommendations
- Monitor rate limit violations
- Track prompt injection attempts
- Log authentication failures
- Monitor API usage and costs
- Set up alerts for suspicious patterns

### Current Implementation
- Suspicious input attempts logged with patterns detected
- Error logging for failed operations
- Usage tracking service for feature usage

## 11. CORS Configuration

### Implementation
- **Location**: `src/main.ts`
- **Configuration**: 
  - Configurable via `CORS_ORIGIN` environment variable
  - Default origins for development
  - Credentials enabled for authenticated requests

### Security
- Specific origin whitelist (no wildcards in production)
- Credentials only allowed for whitelisted origins
- Specific HTTP methods allowed

## 12. Error Handling

### Best Practices
- Generic error messages for users (no sensitive info)
- Detailed errors logged server-side only
- Proper HTTP status codes
- No stack traces exposed in production

## Security Review Checklist

Before deploying to production, ensure:

- [ ] All environment variables are set and secure
- [ ] Rate limits are appropriate for expected traffic
- [ ] Security headers are tested and working
- [ ] Input validation covers all user inputs
- [ ] Prompt injection guard is tested with various attack patterns
- [ ] Database credentials are secure and rotated
- [ ] API keys are rotated regularly
- [ ] HTTPS is enforced in production
- [ ] CORS origins are restricted to known domains
- [ ] Logging and monitoring are set up
- [ ] Error messages don't leak sensitive information
- [ ] All dependencies are up to date (run `npm audit`)

## Incident Response

If a security issue is detected:

1. **Immediate**: Block the offending IP/user if necessary
2. **Investigate**: Review logs to understand the attack vector
3. **Mitigate**: Apply additional rate limiting or blocking
4. **Update**: Enhance security measures if needed
5. **Document**: Record the incident and response

## Contact

For security concerns, please contact the development team.




