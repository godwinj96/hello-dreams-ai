import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserContextEmbeddingsTable1770000000000
  implements MigrationInterface
{
  name = 'CreateUserContextEmbeddingsTable1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_context_embeddings table
    await queryRunner.query(`
            CREATE TABLE "user_context_embeddings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "contentType" character varying(50) NOT NULL,
                "contentId" uuid NOT NULL,
                "content" text NOT NULL,
                "embedding" jsonb NOT NULL,
                "metadata" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_context_embeddings" PRIMARY KEY ("id")
            )
        `);

    // Create index on userId for faster queries
    await queryRunner.query(
      `CREATE INDEX "IDX_user_context_embeddings_userId" ON "user_context_embeddings" ("userId")`,
    );

    // Create index on contentType for filtering
    await queryRunner.query(
      `CREATE INDEX "IDX_user_context_embeddings_contentType" ON "user_context_embeddings" ("contentType")`,
    );

    // Create index on contentId for lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_user_context_embeddings_contentId" ON "user_context_embeddings" ("contentId")`,
    );

    // Create composite index for user + contentType queries
    await queryRunner.query(
      `CREATE INDEX "IDX_user_context_embeddings_user_contentType" ON "user_context_embeddings" ("userId", "contentType")`,
    );

    // Create index on createdAt for sorting
    await queryRunner.query(
      `CREATE INDEX "IDX_user_context_embeddings_createdAt" ON "user_context_embeddings" ("createdAt")`,
    );

    // Add foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "user_context_embeddings" 
            ADD CONSTRAINT "FK_user_context_embeddings_user" 
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    // Create unique constraint on userId + contentType + contentId to prevent duplicates
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_user_context_embeddings_unique" 
            ON "user_context_embeddings" ("userId", "contentType", "contentId")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop unique constraint
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_context_embeddings_unique"`,
    );

    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "user_context_embeddings" DROP CONSTRAINT "FK_user_context_embeddings_user"`,
    );

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_context_embeddings_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_context_embeddings_user_contentType"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_context_embeddings_contentId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_context_embeddings_contentType"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_context_embeddings_userId"`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE "user_context_embeddings"`);
  }
}
