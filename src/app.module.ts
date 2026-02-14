import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
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
import { LinkedInProfile } from './linkedin-optimization/entities/linkedin-profile.entity';
import { HeadshotGeneration } from './headshot-generator/entities/headshot-generation.entity';
import { UsageTracking } from './admin/entities/usage-tracking.entity';
import { Payment } from './payments/entities/payment.entity';
import { Subscription } from './payments/entities/subscription.entity';
import { UserContextEmbedding } from './shared/entities/user-context-embedding.entity';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { ResumeBuilderModule } from './resume-builder/resume-builder.module';
import { ProfessionalProfileModule } from './professional-profile/professional-profile.module';
import { CareerProfileModule } from './career-profile/career-profile.module';
import { PersonaBuilderModule } from './persona-builder/persona-builder.module';
import { DocumentGeneratorModule } from './document-generator/document-generator.module';
import { LinkedInOptimizationModule } from './linkedin-optimization/linkedin-optimization.module';
import { HeadshotGeneratorModule } from './headshot-generator/headshot-generator.module';
import { AdminModule } from './admin/admin.module';
import { SharedModule } from './shared/shared.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute for standard endpoints
      },
      {
        name: 'ai-generation',
        ttl: 3600000, // 1 hour
        limit: 10, // 10 requests per hour for AI generation
      },
      {
        name: 'chat',
        ttl: 3600000, // 1 hour
        limit: 30, // 30 requests per hour for chat/message endpoints
      },
      {
        name: 'public',
        ttl: 60000, // 1 minute
        limit: 20, // 20 requests per minute for public endpoints
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL');
        
        // Support both DATABASE_URL (connection string) and individual DB_* variables
        if (databaseUrl) {
          return {
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
              LinkedInProfile,
              HeadshotGeneration,
              UsageTracking,
              Payment,
              Subscription,
              UserContextEmbedding,
            ],
            synchronize: false,
          };
        } else {
          return {
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
              LinkedInProfile,
              HeadshotGeneration,
              UsageTracking,
              Payment,
              Subscription,
              UserContextEmbedding,
            ],
            synchronize: false,
          };
        }
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ResumeBuilderModule,
    ProfessionalProfileModule,
    CareerProfileModule,
    PersonaBuilderModule,
    DocumentGeneratorModule,
    LinkedInOptimizationModule,
    HeadshotGeneratorModule,
    AdminModule,
    SharedModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule {}
