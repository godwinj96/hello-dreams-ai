<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository with AI-powered resume builder functionality.

## Features

- **User Authentication**: JWT-based authentication with Google OAuth support
- **AI Resume Builder**: Conversational AI assistant that helps users build ATS-friendly resumes
- **Multi-Provider AI Support**: Supports HuggingFace (development) and Ollama (production) backends
- **Resume Management**: Store and manage multiple resume conversations and generated resumes

## Project setup

```bash
$ npm install
```

### Environment Variables

Create a `.env` file in the root directory based on `.env.example`. Required environment variables:

**Database:**
- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_USERNAME` - Database username (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `DB_NAME` - Database name (default: hello_dreams_ai)

**JWT:**
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRATION` - Token expiration time (default: 15m)

**AI Provider (Chat & Documents):**
- `OPENAI_API_KEY` - Your OpenAI API key. When set, all chat/document features (resume builder, career profile, LinkedIn optimization, document generator) use OpenAI/ChatGPT.
- `OPENAI_CHAT_MODEL` - Optional. Overrides the default chat model (default: `gpt-4.1-mini`).
- `AI_PROVIDER` - Fallback provider for chat **only when `OPENAI_API_KEY` is not set**. Set to `huggingface` for development or `ollama` for local models (default: `huggingface`).

**Embeddings:**
- Uses OpenAI `text-embedding-3-small` automatically when `OPENAI_API_KEY` is set (no extra env needed).

**Voice (Speech-to-Text & Text-to-Speech):**
- Uses OpenAI `whisper-1` and `tts-1` automatically when `OPENAI_API_KEY` is set.

**Image & Headshot Generation:**
- Primary provider: OpenAI Images (`gpt-image-1`) via `OPENAI_API_KEY`.
- Fallback providers (optional):
  - `GEMINI_API_KEY` - Enables Gemini 2.5 Flash Image as a fallback for headshots.
  - `HUGGINGFACE_API_KEY` - Enables HuggingFace image-to-image as a final fallback for headshots.

> Note: `REPLICATE_API_TOKEN` is supported only for an experimental/legacy headshot path and is not used by the main headshot generator.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## API Endpoints

### Resume Builder

All endpoints require JWT authentication.

- `POST /resume-builder/conversations` - Create a new resume conversation
- `GET /resume-builder/conversations` - List all conversations for the authenticated user (supports pagination)
- `GET /resume-builder/conversations/:id` - Get conversation details with messages (supports message pagination)
- `PUT /resume-builder/conversations/:id` - Update conversation metadata
- `DELETE /resume-builder/conversations/:id` - Delete a conversation
- `POST /resume-builder/conversations/:id/messages` - Send a message to the AI assistant
- `GET /resume-builder/conversations/:id/resume` - Get generated resume for a conversation
- `POST /resume-builder/conversations/:id/generate` - Manually trigger resume generation

### Pagination

Several GET endpoints support pagination to handle large datasets efficiently:

#### GET /resume-builder/conversations

Returns a paginated list of conversations. Use query parameters to control pagination:

**Query Parameters:**
- `page` (optional, number): Page number (1-indexed). Default: `1`
- `limit` (optional, number): Number of items per page. Default: `10`, Maximum: `100`

**Example Request:**
```
GET /resume-builder/conversations?page=1&limit=20
```

**Response Format:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "My Resume",
      "status": "active",
      "targetJobTitle": "Software Engineer",
      "targetIndustry": "Technology",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "messages": [...]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasPrevious": false,
    "hasNext": true
  }
}
```

#### GET /resume-builder/conversations/:id

Returns conversation details with messages. Optionally paginate messages using query parameters:

**Query Parameters:**
- `page` (optional, number): Page number for messages (1-indexed). If not provided, all messages are returned (backward compatible)
- `limit` (optional, number): Number of messages per page. Default: `10`, Maximum: `100`. Only used if `page` is provided

**Example Requests:**
```
# Get all messages (backward compatible)
GET /resume-builder/conversations/:id

# Get paginated messages
GET /resume-builder/conversations/:id?page=1&limit=10
```

**Response Format (with pagination):**
```json
{
  "id": "uuid",
  "title": "My Resume",
  "status": "active",
  "targetJobTitle": "Software Engineer",
  "targetIndustry": "Technology",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Hello",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "messagesMeta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasPrevious": false,
    "hasNext": true
  }
}
```

**Note:** If pagination parameters are not provided, the endpoint returns all messages (maintains backward compatibility with existing frontend implementations).

### Swagger Documentation

For detailed API documentation with interactive testing, visit `/api` when the application is running. The Swagger UI includes:
- Complete endpoint descriptions
- Request/response schemas
- Pagination parameter documentation
- Try-it-out functionality

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
