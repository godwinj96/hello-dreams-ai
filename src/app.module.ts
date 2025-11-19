import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ResumeBuilderModule } from './resume-builder/resume-builder.module';
import { ProfessionalProfileModule } from './professional-profile/professional-profile.module';
import { CareerProfileModule } from './career-profile/career-profile.module';
import { PersonaBuilderModule } from './persona-builder/persona-builder.module';
import { DocumentGeneratorModule } from './document-generator/document-generator.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
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
        synchronize: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ResumeBuilderModule,
    ProfessionalProfileModule,
    CareerProfileModule,
    PersonaBuilderModule,
    DocumentGeneratorModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
