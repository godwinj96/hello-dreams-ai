import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
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

// Load environment variables
config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
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
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  logging: true,
});

