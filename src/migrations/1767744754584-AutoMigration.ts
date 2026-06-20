import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoMigration1767744754584 implements MigrationInterface {
  name = 'AutoMigration1767744754584';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying, "name" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "avatar_url" character varying, "googleId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying NOT NULL, "userId" uuid NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4542dd2f38a61354a040ba9fd5" ON "refresh_tokens" ("token") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."resume_conversations_status_enum" AS ENUM('active', 'completed', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "resume_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying, "status" "public"."resume_conversations_status_enum" NOT NULL DEFAULT 'active', "targetJobTitle" character varying, "targetIndustry" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b78e7bb626e2f106b4f08345635" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."resume_messages_role_enum" AS ENUM('user', 'assistant', 'system')`,
    );
    await queryRunner.query(
      `CREATE TABLE "resume_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "role" "public"."resume_messages_role_enum" NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e51fb025446aef4da260711d08f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_191f5d02fa8ad7e83fb41cf077" ON "resume_messages" ("conversationId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "resumes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "userId" uuid NOT NULL, "content" text NOT NULL, "version" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5d5a32a6e17c65dc6a2d3230993" UNIQUE ("conversationId"), CONSTRAINT "REL_5d5a32a6e17c65dc6a2d323099" UNIQUE ("conversationId"), CONSTRAINT "PK_9c8677802096d6baece48429d2e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5d5a32a6e17c65dc6a2d323099" ON "resumes" ("conversationId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "resume_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "resumeId" uuid NOT NULL, "contactInfo" jsonb, "workExperience" jsonb, "education" jsonb, "skills" jsonb, "certifications" jsonb, "projects" jsonb, "languages" jsonb, "achievements" jsonb, "summary" text, "keyAchievements" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d6b421143049ab114276a664510" UNIQUE ("resumeId"), CONSTRAINT "REL_d6b421143049ab114276a66451" UNIQUE ("resumeId"), CONSTRAINT "PK_4d3f309aa8bdbcaf39267de8e16" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "professional_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "careerGoals" jsonb, "basicInfo" jsonb, "targetJob" jsonb, "cvMetadata" jsonb, "interactionMode" character varying(20), "cvUploadUrl" text, "persona" jsonb, "personaData" jsonb, "extractedData" jsonb, "completedSections" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_39f14701fcd89b15361c21cc6d7" UNIQUE ("userId"), CONSTRAINT "REL_39f14701fcd89b15361c21cc6d" UNIQUE ("userId"), CONSTRAINT "PK_b2140d2f56b0910e4c58ab4d2a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."career_conversations_status_enum" AS ENUM('active', 'completed', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "career_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying, "status" "public"."career_conversations_status_enum" NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5c43cd920aa8dd8f12e8f7fa4ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."career_messages_role_enum" AS ENUM('user', 'assistant', 'system')`,
    );
    await queryRunner.query(
      `CREATE TABLE "career_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "role" "public"."career_messages_role_enum" NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7f5cc807d69d003ce982f95752e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "persona_answers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "questionId" character varying NOT NULL, "question" text NOT NULL, "answer" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_15dab16b87b501c78af5db01446" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_conversations_documenttype_enum" AS ENUM('cover-letter', 'personal-statement')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_conversations_status_enum" AS ENUM('active', 'completed', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying, "documentType" "public"."document_conversations_documenttype_enum" NOT NULL, "status" "public"."document_conversations_status_enum" NOT NULL DEFAULT 'active', "targetJobTitle" character varying, "targetCompany" character varying, "jobDescription" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_97020d86b6c20d946cbee6dd8fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_messages_role_enum" AS ENUM('user', 'assistant', 'system')`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "role" "public"."document_messages_role_enum" NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8e9d750443766be80b6d6597691" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1defda863eaf45861e555f618b" ON "document_messages" ("conversationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."documents_documenttype_enum" AS ENUM('cover-letter', 'personal-statement')`,
    );
    await queryRunner.query(
      `CREATE TABLE "documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "conversationId" uuid NOT NULL, "documentType" "public"."documents_documenttype_enum" NOT NULL, "content" text NOT NULL, "version" integer NOT NULL DEFAULT '1', "targetJobTitle" character varying, "targetCompany" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_8db8f7d8a6cb468c2d11c77075" UNIQUE ("conversationId"), CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_conversations" ADD CONSTRAINT "FK_151857b8610df6b852a3c6b57fe" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_messages" ADD CONSTRAINT "FK_191f5d02fa8ad7e83fb41cf0774" FOREIGN KEY ("conversationId") REFERENCES "resume_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resumes" ADD CONSTRAINT "FK_5d5a32a6e17c65dc6a2d3230993" FOREIGN KEY ("conversationId") REFERENCES "resume_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resumes" ADD CONSTRAINT "FK_339097f7bb65e85c34f033df05b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_data" ADD CONSTRAINT "FK_d6b421143049ab114276a664510" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_profiles" ADD CONSTRAINT "FK_39f14701fcd89b15361c21cc6d7" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_conversations" ADD CONSTRAINT "FK_a9aafa5ab69c0e6b3a5fec201a4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_messages" ADD CONSTRAINT "FK_a47d18aa83f414bae47376ffd72" FOREIGN KEY ("conversationId") REFERENCES "career_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "persona_answers" ADD CONSTRAINT "FK_3016884758a2b49ca29ca58aa4f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_conversations" ADD CONSTRAINT "FK_d09e07ce346f9f01a83fd0b9394" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_messages" ADD CONSTRAINT "FK_1defda863eaf45861e555f618b8" FOREIGN KEY ("conversationId") REFERENCES "document_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_e300b5c2e3fefa9d6f8a3f25975" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_8db8f7d8a6cb468c2d11c770751" FOREIGN KEY ("conversationId") REFERENCES "document_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_8db8f7d8a6cb468c2d11c770751"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_e300b5c2e3fefa9d6f8a3f25975"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_messages" DROP CONSTRAINT "FK_1defda863eaf45861e555f618b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_conversations" DROP CONSTRAINT "FK_d09e07ce346f9f01a83fd0b9394"`,
    );
    await queryRunner.query(
      `ALTER TABLE "persona_answers" DROP CONSTRAINT "FK_3016884758a2b49ca29ca58aa4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_messages" DROP CONSTRAINT "FK_a47d18aa83f414bae47376ffd72"`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_conversations" DROP CONSTRAINT "FK_a9aafa5ab69c0e6b3a5fec201a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_profiles" DROP CONSTRAINT "FK_39f14701fcd89b15361c21cc6d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_data" DROP CONSTRAINT "FK_d6b421143049ab114276a664510"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resumes" DROP CONSTRAINT "FK_339097f7bb65e85c34f033df05b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resumes" DROP CONSTRAINT "FK_5d5a32a6e17c65dc6a2d3230993"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_messages" DROP CONSTRAINT "FK_191f5d02fa8ad7e83fb41cf0774"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_conversations" DROP CONSTRAINT "FK_151857b8610df6b852a3c6b57fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TYPE "public"."documents_documenttype_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1defda863eaf45861e555f618b"`,
    );
    await queryRunner.query(`DROP TABLE "document_messages"`);
    await queryRunner.query(`DROP TYPE "public"."document_messages_role_enum"`);
    await queryRunner.query(`DROP TABLE "document_conversations"`);
    await queryRunner.query(
      `DROP TYPE "public"."document_conversations_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."document_conversations_documenttype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "persona_answers"`);
    await queryRunner.query(`DROP TABLE "career_messages"`);
    await queryRunner.query(`DROP TYPE "public"."career_messages_role_enum"`);
    await queryRunner.query(`DROP TABLE "career_conversations"`);
    await queryRunner.query(
      `DROP TYPE "public"."career_conversations_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "professional_profiles"`);
    await queryRunner.query(`DROP TABLE "resume_data"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5d5a32a6e17c65dc6a2d323099"`,
    );
    await queryRunner.query(`DROP TABLE "resumes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_191f5d02fa8ad7e83fb41cf077"`,
    );
    await queryRunner.query(`DROP TABLE "resume_messages"`);
    await queryRunner.query(`DROP TYPE "public"."resume_messages_role_enum"`);
    await queryRunner.query(`DROP TABLE "resume_conversations"`);
    await queryRunner.query(
      `DROP TYPE "public"."resume_conversations_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4542dd2f38a61354a040ba9fd5"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
