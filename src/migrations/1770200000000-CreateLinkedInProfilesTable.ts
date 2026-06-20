import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLinkedInProfilesTable1770200000000
  implements MigrationInterface
{
  name = 'CreateLinkedInProfilesTable1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // userId must be uuid to match users.id (FK constraint requires type parity in PostgreSQL)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "linkedin_profiles" (
        "id"               uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "userId"           uuid        NOT NULL,
        "headline"         jsonb,
        "about"            text,
        "topSkills"        jsonb,
        "experience"       jsonb,
        "education"        jsonb,
        "certifications"   jsonb,
        "skills"           jsonb,
        "volunteering"     jsonb,
        "createdAt"        TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_linkedin_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_linkedin_profiles"        PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "linkedin_profiles"
        ADD CONSTRAINT "FK_linkedin_profiles_user"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "linkedin_profiles" DROP CONSTRAINT "FK_linkedin_profiles_user"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "linkedin_profiles"`);
  }
}
