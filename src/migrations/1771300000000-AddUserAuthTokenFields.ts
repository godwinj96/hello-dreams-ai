import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAuthTokenFields1771300000000
  implements MigrationInterface
{
  name = 'AddUserAuthTokenFields1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying,
        ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "passwordResetToken" character varying,
        ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "passwordResetExpires",
        DROP COLUMN IF EXISTS "passwordResetToken",
        DROP COLUMN IF EXISTS "emailVerificationExpires",
        DROP COLUMN IF EXISTS "emailVerificationToken",
        DROP COLUMN IF EXISTS "emailVerified"
    `);
  }
}
