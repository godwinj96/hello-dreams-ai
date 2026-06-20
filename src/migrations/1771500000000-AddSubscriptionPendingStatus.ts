import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionPendingStatus1771500000000
  implements MigrationInterface
{
  name = 'AddSubscriptionPendingStatus1771500000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // subscriptions.status is character varying (see 1735689600000 migration).
    // 'pending' is valid without altering the schema.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No schema change to revert.
  }
}
