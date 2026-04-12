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
import { Payment } from './payments/entities/payment.entity';
import { Subscription } from './payments/entities/subscription.entity';
import { LinkedInProfile } from './linkedin-optimization/entities/linkedin-profile.entity';

// Load .env from project root
const envPath = resolve(__dirname, '../.env');
config({ path: envPath });

const configService = new ConfigService();

// ✅ Correct migration glob (ts + js)
const migrations = [__dirname + '/migrations/*{.ts,.js}'];

// Prefer DATABASE_URL (Supabase)
const databaseUrl =
  configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

export const AppDataSource = new DataSource({
  type: 'postgres',

  // ✅ Always provide ALL PostgresConnectionOptions fields
  host: databaseUrl ? undefined : configService.get('DB_HOST', 'localhost'),
  port: databaseUrl ? undefined : configService.get<number>('DB_PORT', 5432),
  username: databaseUrl ? undefined : configService.get('DB_USERNAME', 'postgres'),
  password: databaseUrl ? undefined : configService.get('DB_PASSWORD', 'postgres'),
  database: databaseUrl ? undefined : configService.get('DB_NAME', 'hello_dreams_ai'),

  // ✅ Supabase connection string
  url: databaseUrl || undefined,

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
    Payment,
    Subscription,
    LinkedInProfile,
  ],

  migrations,
  synchronize: false, 
});