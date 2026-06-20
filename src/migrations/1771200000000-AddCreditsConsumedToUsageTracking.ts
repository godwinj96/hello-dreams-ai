import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditsConsumedToUsageTracking1771200000000
  implements MigrationInterface
{
  name = 'AddCreditsConsumedToUsageTracking1771200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usage_tracking"
        ADD COLUMN IF NOT EXISTS "creditsConsumed" numeric(10,4) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usage_tracking"
        DROP COLUMN IF EXISTS "creditsConsumed"
    `);
  }
}
