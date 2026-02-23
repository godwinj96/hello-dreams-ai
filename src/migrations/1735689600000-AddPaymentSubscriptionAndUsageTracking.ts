import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentSubscriptionAndUsageTracking1735689600000
  implements MigrationInterface
{
  name = 'AddPaymentSubscriptionAndUsageTracking1735689600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add credits and subscriptionId to users table
    await queryRunner.query(
      `ALTER TABLE "users" ADD "credits" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "subscriptionId" uuid`,
    );

    // Add token and cost tracking columns to usage_tracking table
    await queryRunner.query(
      `ALTER TABLE "usage_tracking" ADD "tokensUsed" integer DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_tracking" ADD "costUsd" numeric(10,6) DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_tracking" ADD "costNgn" numeric(10,2) DEFAULT 0`,
    );

    // Create subscriptions table
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "planId" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "billingCycle" character varying NOT NULL,
        "currentPeriodStart" TIMESTAMP NOT NULL,
        "currentPeriodEnd" TIMESTAMP NOT NULL,
        "paystackSubscriptionCode" character varying,
        "paystackCustomerCode" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
      )
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'NGN',
        "status" character varying NOT NULL DEFAULT 'pending',
        "paystackReference" character varying,
        "type" character varying NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for subscriptions
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_userId" ON "subscriptions" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_status" ON "subscriptions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_paystackSubscriptionCode" ON "subscriptions" ("paystackSubscriptionCode")`,
    );

    // Create indexes for payments
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_userId" ON "payments" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_status" ON "payments" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_paystackReference" ON "payments" ("paystackReference")`,
    );

    // Create indexes for usage_tracking token/cost queries
    await queryRunner.query(
      `CREATE INDEX "IDX_usage_tracking_userId_createdAt" ON "usage_tracking" ("userId", "createdAt")`,
    );

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "subscriptions" 
      ADD CONSTRAINT "FK_subscriptions_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_subscription" 
      FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_subscription"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_user"`,
    );

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX "public"."IDX_usage_tracking_userId_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_payments_paystackReference"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_userId"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_subscriptions_paystackSubscriptionCode"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_subscriptions_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_subscriptions_userId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);

    // Remove columns from usage_tracking
    await queryRunner.query(`ALTER TABLE "usage_tracking" DROP COLUMN "costNgn"`);
    await queryRunner.query(`ALTER TABLE "usage_tracking" DROP COLUMN "costUsd"`);
    await queryRunner.query(`ALTER TABLE "usage_tracking" DROP COLUMN "tokensUsed"`);

    // Remove columns from users
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subscriptionId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "credits"`);
  }
}





