import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import { User } from './users/entities/user.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { ResumeConversation } from './resume-builder/entities/resume-conversation.entity';
import { ResumeMessage } from './resume-builder/entities/resume-message.entity';
import { Resume } from './resume-builder/entities/resume.entity';
import { ResumeData } from './resume-builder/entities/resume-data.entity';
import { ProfessionalProfile } from './professional-profile/entities/professional-profile.entity';
import { CareerConversation } from './career-profile/entities/career-conversation.entity';
import { CareerMessage } from './career-profile/entities/career-message.entity';
import { PersonaAnswer } from './persona-builder/entities/persona-answer.entity';
import { DocumentConversation } from './document-generator/entities/document-conversation.entity';
import { DocumentMessage } from './document-generator/entities/document-message.entity';
import { Document } from './document-generator/entities/document.entity';
import { InitialSchema1700000000000 } from './migrations/1700000000000-InitialSchema';

// Load environment variables from project root
// This ensures .env is found regardless of where the script is run from
// When running from src/, __dirname is src/, so we go up one level to hello-dreams-ai/
// When compiled to dist/, __dirname is dist/, so we go up one level to hello-dreams-ai/
const envPath = resolve(__dirname, '../.env');
const envResult = config({ path: envPath });

const configService = new ConfigService();

// Determine migrations - import directly for ts-node, use glob for compiled
const isCompiled = __dirname.includes('dist') || __filename.includes('dist');
const migrations = isCompiled
  ? ['dist/migrations/*.js']
  : [InitialSchema1700000000000];

// Support both DATABASE_URL (connection string) and individual DB_* variables
const databaseUrl =
  configService.get('DATABASE_URL') || process.env.DATABASE_URL;

// Debug: Log if .env was found and if DATABASE_URL exists
if (process.env.NODE_ENV !== 'production') {
  if (envResult.error && (envResult.error as any).code !== 'ENOENT') {
    console.warn('Warning: Error loading .env file:', envResult.error.message);
  }
  if (!databaseUrl) {
    console.warn(
      'Warning: DATABASE_URL not found in environment variables. Using individual DB_* variables or defaults.',
    );
  }
}

let dataSourceConfig: any;

if (databaseUrl) {
  // Use connection string (e.g., from Supabase)
  dataSourceConfig = {
    type: 'postgres',
    url: databaseUrl,
    entities: [
      User,
      RefreshToken,
      ResumeConversation,
      ResumeMessage,
      Resume,
      ResumeData,
      ProfessionalProfile,
      CareerConversation,
      CareerMessage,
      PersonaAnswer,
      DocumentConversation,
      DocumentMessage,
      Document,
    ],
    migrations: migrations,
    synchronize: false,
    logging: true,
  };
} else {
  // Fall back to individual environment variables
  dataSourceConfig = {
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DB_PASSWORD', 'postgres'),
    database: configService.get('DB_NAME', 'hello_dreams_ai'),
    entities: [
      User,
      RefreshToken,
      ResumeConversation,
      ResumeMessage,
      Resume,
      ResumeData,
      ProfessionalProfile,
      CareerConversation,
      CareerMessage,
      PersonaAnswer,
      DocumentConversation,
      DocumentMessage,
      Document,
    ],
    migrations: migrations,
    synchronize: false,
    logging: true,
  };
}

export const AppDataSource = new DataSource(dataSourceConfig);
