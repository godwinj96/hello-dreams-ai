import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJsonbMessagesAndCreditSystem1770500000000
  implements MigrationInterface
{
  name = 'AddJsonbMessagesAndCreditSystem1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // ── Resume conversations ─────────────────────────────────────────────────
      await queryRunner.query(`
        ALTER TABLE "resume_conversations"
          ADD COLUMN IF NOT EXISTS "messages_jsonb" JSONB NOT NULL DEFAULT '[]'
      `);
      await queryRunner.query(`
        ALTER TABLE "resume_conversations"
          ADD COLUMN IF NOT EXISTS "token_count" INTEGER NOT NULL DEFAULT 0
      `);
      // Backfill from existing rows (preserves all data, zero data loss)
      await queryRunner.query(`
        UPDATE "resume_conversations" rc
        SET "messages_jsonb" = COALESCE(
          (
            SELECT json_agg(
              json_build_object('role', rm.role, 'content', rm.content)
              ORDER BY rm."createdAt" ASC
            )::jsonb
            FROM "resume_messages" rm
            WHERE rm."conversationId" = rc.id
          ),
          '[]'::jsonb
        )
      `);

      // ── Career conversations ─────────────────────────────────────────────────
      await queryRunner.query(`
        ALTER TABLE "career_conversations"
          ADD COLUMN IF NOT EXISTS "messages_jsonb" JSONB NOT NULL DEFAULT '[]'
      `);
      await queryRunner.query(`
        ALTER TABLE "career_conversations"
          ADD COLUMN IF NOT EXISTS "token_count" INTEGER NOT NULL DEFAULT 0
      `);
      await queryRunner.query(`
        UPDATE "career_conversations" cc
        SET "messages_jsonb" = COALESCE(
          (
            SELECT json_agg(
              json_build_object('role', cm.role, 'content', cm.content)
              ORDER BY cm."createdAt" ASC
            )::jsonb
            FROM "career_messages" cm
            WHERE cm."conversationId" = cc.id
          ),
          '[]'::jsonb
        )
      `);

      // ── Document conversations ───────────────────────────────────────────────
      await queryRunner.query(`
        ALTER TABLE "document_conversations"
          ADD COLUMN IF NOT EXISTS "messages_jsonb" JSONB NOT NULL DEFAULT '[]'
      `);
      await queryRunner.query(`
        ALTER TABLE "document_conversations"
          ADD COLUMN IF NOT EXISTS "token_count" INTEGER NOT NULL DEFAULT 0
      `);
      await queryRunner.query(`
        UPDATE "document_conversations" dc
        SET "messages_jsonb" = COALESCE(
          (
            SELECT json_agg(
              json_build_object('role', dm.role, 'content', dm.content)
              ORDER BY dm."createdAt" ASC
            )::jsonb
            FROM "document_messages" dm
            WHERE dm."conversationId" = dc.id
          ),
          '[]'::jsonb
        )
      `);

      // ── Composite index for credit guard query ───────────────────────────────
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_usage_tracking_credit_check"
          ON "usage_tracking" ("userId", "actionType", "createdAt")
      `);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_usage_tracking_credit_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_conversations" DROP COLUMN IF EXISTS "token_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_conversations" DROP COLUMN IF EXISTS "messages_jsonb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_conversations" DROP COLUMN IF EXISTS "token_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_conversations" DROP COLUMN IF EXISTS "messages_jsonb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_conversations" DROP COLUMN IF EXISTS "token_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resume_conversations" DROP COLUMN IF EXISTS "messages_jsonb"`,
    );
  }
}
