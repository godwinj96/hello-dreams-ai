import { AppDataSource } from '../data-source';

async function checkDatabase() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connection initialized\n');

    // Get connection info
    const connection = AppDataSource.manager.connection;
    const options = connection.options as any;
    
    console.log('=== Connection Details ===');
    if (options.url) {
      // Mask password in connection string
      const maskedUrl = options.url.replace(/:[^:@]+@/, ':****@');
      console.log(`Connection String: ${maskedUrl}`);
    } else {
      console.log(`Host: ${options.host}`);
      console.log(`Port: ${options.port}`);
      console.log(`Database: ${options.database}`);
      console.log(`Username: ${options.username}`);
    }
    console.log(`Database Type: ${options.type}`);
    console.log(`Current Schema: ${(options as any).schema || 'public'}\n`);

    // Check if migrations table exists
    console.log('=== Checking Migrations Table ===');
    const migrationsTableExists = await AppDataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    console.log(`Migrations table exists: ${migrationsTableExists[0].exists}`);

    if (migrationsTableExists[0].exists) {
      const migrations = await AppDataSource.query('SELECT * FROM migrations ORDER BY timestamp DESC');
      console.log(`\nMigrations recorded: ${migrations.length}`);
      migrations.forEach((m: any) => {
        console.log(`  - ${m.name} (timestamp: ${m.timestamp})`);
      });
    }

    // List all tables in public schema
    console.log('\n=== Tables in public schema ===');
    const tables = await AppDataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    if (tables.length === 0) {
      console.log('No tables found in public schema!');
    } else {
      console.log(`Found ${tables.length} table(s):`);
      tables.forEach((t: any) => {
        console.log(`  - ${t.table_name}`);
      });
    }

    // Check all schemas
    console.log('\n=== All Schemas ===');
    const schemas = await AppDataSource.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name;
    `);
    schemas.forEach((s: any) => {
      console.log(`  - ${s.schema_name}`);
    });

    await AppDataSource.destroy();
    console.log('\nCheck completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  }
}

checkDatabase();

