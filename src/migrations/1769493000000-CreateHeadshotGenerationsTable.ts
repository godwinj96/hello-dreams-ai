import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHeadshotGenerationsTable1769493000000 implements MigrationInterface {
    name = 'CreateHeadshotGenerationsTable1769493000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create headshot_generations table
        await queryRunner.query(`
            CREATE TABLE "headshot_generations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "originalImageUrl" text,
                "style" character varying(50),
                "personaType" character varying(50),
                "generatedImages" jsonb,
                "status" character varying(20) NOT NULL DEFAULT 'pending',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_headshot_generations" PRIMARY KEY ("id")
            )
        `);
        
        // Create index on userId for faster queries
        await queryRunner.query(`CREATE INDEX "IDX_headshot_generations_userId" ON "headshot_generations" ("userId")`);
        
        // Create index on status for filtering
        await queryRunner.query(`CREATE INDEX "IDX_headshot_generations_status" ON "headshot_generations" ("status")`);
        
        // Create index on createdAt for sorting
        await queryRunner.query(`CREATE INDEX "IDX_headshot_generations_createdAt" ON "headshot_generations" ("createdAt")`);
        
        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "headshot_generations" 
            ADD CONSTRAINT "FK_headshot_generations_user" 
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraint
        await queryRunner.query(`ALTER TABLE "headshot_generations" DROP CONSTRAINT "FK_headshot_generations_user"`);
        
        // Drop indexes
        await queryRunner.query(`DROP INDEX "public"."IDX_headshot_generations_createdAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_headshot_generations_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_headshot_generations_userId"`);
        
        // Drop table
        await queryRunner.query(`DROP TABLE "headshot_generations"`);
    }
}




