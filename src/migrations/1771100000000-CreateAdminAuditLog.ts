import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminAuditLog1771100000000 implements MigrationInterface {
  name = 'CreateAdminAuditLog1771100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "admin_audit_log_action_enum" AS ENUM(
        'user_activated',
        'user_deactivated',
        'user_promoted',
        'user_demoted',
        'user_deleted',
        'admin_created',
        'user_updated'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorId" uuid NOT NULL,
        "actorEmail" character varying NOT NULL,
        "action" "admin_audit_log_action_enum" NOT NULL,
        "targetType" character varying,
        "targetId" character varying,
        "metadata" jsonb,
        "ipAddress" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_log" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_audit_log_actor_created"
      ON "admin_audit_log" ("actorId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_audit_log_action_created"
      ON "admin_audit_log" ("action", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_audit_log_target"
      ON "admin_audit_log" ("targetId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_admin_audit_log_target"`);
    await queryRunner.query(`DROP INDEX "IDX_admin_audit_log_action_created"`);
    await queryRunner.query(`DROP INDEX "IDX_admin_audit_log_actor_created"`);
    await queryRunner.query(`DROP TABLE "admin_audit_log"`);
    await queryRunner.query(`DROP TYPE "admin_audit_log_action_enum"`);
  }
}
