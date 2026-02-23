import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSuperuserRoleAndIsActive1769464066536 implements MigrationInterface {
    name = 'AddSuperuserRoleAndIsActive1769464066536'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add 'superuser' to the role enum
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE 'superuser'`);
        
        // Add isActive column with default true
        await queryRunner.query(`ALTER TABLE "users" ADD "isActive" boolean NOT NULL DEFAULT true`);
        
        // Update all existing users to isActive = true (safety measure)
        await queryRunner.query(`UPDATE "users" SET "isActive" = true WHERE "isActive" IS NULL`);
        
        // Create usage_tracking table
        await queryRunner.query(`
            CREATE TABLE "usage_tracking" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "actionType" character varying NOT NULL,
                "module" character varying NOT NULL,
                "metadata" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_usage_tracking" PRIMARY KEY ("id")
            )
        `);
        
        // Create indexes for performance
        await queryRunner.query(`CREATE INDEX "IDX_usage_tracking_userId" ON "usage_tracking" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_usage_tracking_timestamp" ON "usage_tracking" ("createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_usage_tracking_module" ON "usage_tracking" ("module")`);
        await queryRunner.query(`CREATE INDEX "IDX_usage_tracking_userId_timestamp" ON "usage_tracking" ("userId", "createdAt")`);
        
        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "usage_tracking" 
            ADD CONSTRAINT "FK_usage_tracking_user" 
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop usage_tracking table
        await queryRunner.query(`ALTER TABLE "usage_tracking" DROP CONSTRAINT "FK_usage_tracking_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_usage_tracking_userId_timestamp"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_usage_tracking_module"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_usage_tracking_timestamp"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_usage_tracking_userId"`);
        await queryRunner.query(`DROP TABLE "usage_tracking"`);
        
        // Remove isActive column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
        
        // Note: PostgreSQL doesn't support removing enum values directly
        // The enum will still contain 'superuser' but it won't be used
        // To fully remove, you would need to recreate the enum and column
    }
}






