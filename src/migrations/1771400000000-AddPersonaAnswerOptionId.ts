import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * No-op: optionId column is added in AddOptionIdToPersonaAnswers1771310000000.
 * Retained for databases that already recorded this migration name.
 */
export class AddPersonaAnswerOptionId1771400000000
  implements MigrationInterface
{
  name = 'AddPersonaAnswerOptionId1771400000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Column already handled by AddOptionIdToPersonaAnswers1771310000000
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally empty
  }
}
