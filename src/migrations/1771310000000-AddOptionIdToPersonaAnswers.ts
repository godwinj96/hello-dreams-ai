import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOptionIdToPersonaAnswers1771310000000
  implements MigrationInterface
{
  name = 'AddOptionIdToPersonaAnswers1771310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "persona_answers" ADD COLUMN IF NOT EXISTS "optionId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "persona_answers" DROP COLUMN IF EXISTS "optionId"`,
    );
  }
}
