import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "role_enum" AS ENUM ('user', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "conversation_status_enum" AS ENUM ('active', 'completed', 'archived');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "message_role_enum" AS ENUM ('user', 'assistant', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "document_type_enum" AS ENUM ('cover-letter', 'personal-statement');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying,
        "name" character varying NOT NULL,
        "role" "role_enum" NOT NULL DEFAULT 'user',
        "googleId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_googleId" UNIQUE ("googleId"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying NOT NULL,
        "userId" uuid NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_token" ON "refresh_tokens" ("token")
    `);

    // Create resume_conversations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resume_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "title" character varying,
        "status" "conversation_status_enum" NOT NULL DEFAULT 'active',
        "targetJobTitle" character varying,
        "targetIndustry" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resume_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_conversations_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create resume_messages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resume_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "role" "message_role_enum" NOT NULL,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resume_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_messages_conversation" FOREIGN KEY ("conversationId") REFERENCES "resume_conversations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_resume_messages_conversationId" ON "resume_messages" ("conversationId")
    `);

    // Create resumes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resumes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "content" text NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_resumes_conversationId" UNIQUE ("conversationId"),
        CONSTRAINT "PK_resumes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resumes_conversation" FOREIGN KEY ("conversationId") REFERENCES "resume_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_resumes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_resumes_conversationId" ON "resumes" ("conversationId")
    `);

    // Create resume_data table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resume_data" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resumeId" uuid NOT NULL,
        "contactInfo" jsonb,
        "workExperience" jsonb,
        "education" jsonb,
        "skills" jsonb,
        "certifications" jsonb,
        "projects" jsonb,
        "languages" jsonb,
        "achievements" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_resume_data_resumeId" UNIQUE ("resumeId"),
        CONSTRAINT "PK_resume_data" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resume_data_resume" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE
      )
    `);

    // Create professional_profiles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professional_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "careerGoals" jsonb,
        "persona" jsonb,
        "extractedData" jsonb,
        "completedSections" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_professional_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_professional_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_professional_profiles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create career_conversations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "career_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "title" character varying,
        "status" "conversation_status_enum" NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_career_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_career_conversations_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create career_messages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "career_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "role" "message_role_enum" NOT NULL,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_career_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_career_messages_conversation" FOREIGN KEY ("conversationId") REFERENCES "career_conversations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_career_messages_conversationId" ON "career_messages" ("conversationId")
    `);

    // Create persona_answers table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "persona_answers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "questionId" character varying NOT NULL,
        "question" text NOT NULL,
        "answer" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_persona_answers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_persona_answers_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create document_conversations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "title" character varying,
        "status" "conversation_status_enum" NOT NULL DEFAULT 'active',
        "documentType" "document_type_enum" NOT NULL,
        "targetJobTitle" character varying,
        "targetCompany" character varying,
        "jobDescription" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_document_conversations_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create document_messages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "role" "message_role_enum" NOT NULL,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_document_messages_conversation" FOREIGN KEY ("conversationId") REFERENCES "document_conversations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_document_messages_conversationId" ON "document_messages" ("conversationId")
    `);

    // Create documents table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "documentType" "document_type_enum" NOT NULL,
        "content" text NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "targetJobTitle" character varying,
        "targetCompany" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_documents_conversationId" UNIQUE ("conversationId"),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_conversation" FOREIGN KEY ("conversationId") REFERENCES "document_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_conversationId" ON "documents" ("conversationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_conversations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "persona_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "career_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "career_conversations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "professional_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_data"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resumes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resume_conversations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "document_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "message_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "conversation_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role_enum"`);
  }
}

