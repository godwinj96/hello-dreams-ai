-- Manual SQL script to create resume builder tables if TypeORM synchronize doesn't work
-- Run this in your PostgreSQL database if tables aren't being created automatically

-- Create enum types first (PostgreSQL requirement)
DO $$ BEGIN
    CREATE TYPE "conversation_status_enum" AS ENUM ('active', 'completed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "message_role_enum" AS ENUM ('user', 'assistant', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create resume_conversations table
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
);

-- Create resume_messages table
CREATE TABLE IF NOT EXISTS "resume_messages" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "conversationId" uuid NOT NULL,
    "role" "message_role_enum" NOT NULL,
    "content" text NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "PK_resume_messages" PRIMARY KEY ("id"),
    CONSTRAINT "FK_resume_messages_conversation" FOREIGN KEY ("conversationId") REFERENCES "resume_conversations"("id") ON DELETE CASCADE
);

-- Create index on conversationId for messages
CREATE INDEX IF NOT EXISTS "IDX_resume_messages_conversationId" ON "resume_messages" ("conversationId");

-- Create resumes table
CREATE TABLE IF NOT EXISTS "resumes" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "conversationId" uuid NOT NULL UNIQUE,
    "userId" uuid NOT NULL,
    "content" text NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "PK_resumes" PRIMARY KEY ("id"),
    CONSTRAINT "FK_resumes_conversation" FOREIGN KEY ("conversationId") REFERENCES "resume_conversations"("id") ON DELETE CASCADE,
    CONSTRAINT "FK_resumes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create index on conversationId for resumes
CREATE INDEX IF NOT EXISTS "IDX_resumes_conversationId" ON "resumes" ("conversationId");

-- Create resume_data table (optional)
CREATE TABLE IF NOT EXISTS "resume_data" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "resumeId" uuid NOT NULL UNIQUE,
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
    CONSTRAINT "PK_resume_data" PRIMARY KEY ("id"),
    CONSTRAINT "FK_resume_data_resume" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE
);

