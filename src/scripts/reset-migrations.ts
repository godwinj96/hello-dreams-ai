import { AppDataSource } from '../data-source';

async function resetMigrations() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connection initialized');

    console.log('Clearing migration records...');
    // Check if migrations table exists first
    const tableExists = await AppDataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    
    if (tableExists[0].exists) {
      await AppDataSource.query('DELETE FROM migrations');
      console.log('Migration records cleared');
    } else {
      console.log('Migrations table does not exist - nothing to clear');
    }

    await AppDataSource.destroy();
    console.log('Reset completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting migrations:', error);
    process.exit(1);
  }
}

resetMigrations();

