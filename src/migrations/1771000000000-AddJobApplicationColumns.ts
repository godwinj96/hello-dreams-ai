import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobApplicationColumns1771000000000
  implements MigrationInterface
{
  name = 'AddJobApplicationColumns1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create job_listings table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_listings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "externalId" character varying(255),
        "title" character varying(255) NOT NULL,
        "company" character varying(255),
        "location" character varying(255),
        "description" text,
        "salary" character varying(100),
        "jobType" character varying(50),
        "skills" jsonb,
        "experienceLevel" character varying(50),
        "source" character varying(100),
        "sourceUrl" text,
        "postedDate" TIMESTAMP,
        "matchScore" numeric,
        "rawData" jsonb,
        "isRemote" boolean NOT NULL DEFAULT false,
        "country" character varying(10),
        "atsType" character varying(50),
        "atsBoardToken" character varying(255),
        "atsJobId" character varying(255),
        "applicationUrl" text,
        "cachedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_listings" PRIMARY KEY ("id")
      )
    `);

    // Create job_applications table if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."job_applications_status_enum" AS ENUM('saved','applied','interviewing','offered','rejected','withdrawn');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "jobListingId" uuid NOT NULL,
        "status" "public"."job_applications_status_enum" NOT NULL DEFAULT 'saved',
        "appliedAt" TIMESTAMP,
        "customCvId" uuid,
        "customCoverLetterId" uuid,
        "notes" text,
        "atsApplicationId" character varying(255),
        "atsSubmittedAt" TIMESTAMP,
        "generatedResumeContent" jsonb,
        "generatedCoverLetterContent" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_applications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_job_applications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_job_applications_listing" FOREIGN KEY ("jobListingId") REFERENCES "job_listings"("id") ON DELETE CASCADE
      )
    `);

    // If tables already existed, add missing columns individually
    const listingColumns = [
      `ALTER TABLE "job_listings" ADD COLUMN IF NOT EXISTS "isRemote" boolean NOT NULL DEFAULT false`,
      `ALTER TABLE "job_listings" ADD COLUMN IF NOT EXISTS "country" character varying(10)`,
      `ALTER TABLE "job_listings" ADD COLUMN IF NOT EXISTS "atsType" character varying(50)`,
      `ALTER TABLE "job_listings" ADD COLUMN IF NOT EXISTS "atsBoardToken" character varying(255)`,
      `ALTER TABLE "job_listings" ADD COLUMN IF NOT EXISTS "atsJobId" character varying(255)`,
      `ALTER TABLE "job_listings" ADD COLUMN IF NOT EXISTS "applicationUrl" text`,
      `ALTER TABLE "job_listings" ADD COLUMN IF NOT EXISTS "cachedAt" TIMESTAMP`,
    ];

    const appColumns = [
      `ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "atsApplicationId" character varying(255)`,
      `ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "atsSubmittedAt" TIMESTAMP`,
      `ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "generatedResumeContent" jsonb`,
      `ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "generatedCoverLetterContent" jsonb`,
    ];

    for (const sql of [...listingColumns, ...appColumns]) {
      await queryRunner.query(sql);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "job_applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_listings"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."job_applications_status_enum"`,
    );
  }
}
