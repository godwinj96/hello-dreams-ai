import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
import { AppDataSource } from '../data-source';

async function promoteUser() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const email = process.argv[2];
    const targetRole = process.argv[3]?.toLowerCase(); // 'admin' or 'superuser'

    if (!email || !targetRole) {
      console.error('Usage: npm run promote-user <email> <role>');
      console.error('Example: npm run promote-user user@example.com admin');
      console.error('Example: npm run promote-user user@example.com superuser');
      process.exit(1);
    }

    if (targetRole !== 'admin' && targetRole !== 'superuser') {
      console.error('Error: Role must be either "admin" or "superuser"');
      process.exit(1);
    }

    const userRepository = AppDataSource.getRepository(User);

    // Find user by email
    const user = await userRepository.findOne({ where: { email } });
    if (!user) {
      console.error(`Error: User with email ${email} not found`);
      process.exit(1);
    }

    // Update role
    const role = targetRole === 'superuser' ? Role.Superuser : Role.Admin;
    user.role = role;
    user.isActive = true; // Ensure user is active
    await userRepository.save(user);

    console.log(`✓ User ${email} has been promoted to ${targetRole}`);
    console.log(`  - Role: ${user.role}`);
    console.log(`  - Active: ${user.isActive}`);

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error promoting user:', error);
    process.exit(1);
  }
}

promoteUser();

