import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionPaystackReference1771600000000
  implements MigrationInterface
{
  name = 'AddSubscriptionPaystackReference1771600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD COLUMN IF NOT EXISTS "paystackReference" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        DROP COLUMN IF EXISTS "paystackReference"
    `);
  }
}
