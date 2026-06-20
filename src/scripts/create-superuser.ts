import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';
import { AppDataSource } from '../data-source';

async function createSuperuser() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const email = process.argv[2];
    const password = process.argv[3];
    const name = process.argv[4] || 'Superuser';

    if (!email || !password) {
      console.error(
        'Usage: npm run create-superuser <email> <password> [name]',
      );
      console.error(
        'Example: npm run create-superuser admin@example.com SecurePassword123! "Admin User"',
      );
      process.exit(1);
    }

    const userRepository = AppDataSource.getRepository(User);

    // Check if user already exists
    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      console.log(
        `User with email ${email} already exists. Updating to superuser...`,
      );
      existingUser.role = Role.Superuser;
      existingUser.isActive = true;
      if (password) {
        existingUser.password = await bcrypt.hash(password, 10);
      }
      await userRepository.save(existingUser);
      console.log(`✓ User ${email} is now a superuser`);
    } else {
      // Create new superuser
      const hashedPassword = await bcrypt.hash(password, 10);
      const superuser = userRepository.create({
        email,
        password: hashedPassword,
        name,
        role: Role.Superuser,
        isActive: true,
      });

      await userRepository.save(superuser);
      console.log(`✓ Superuser created: ${email}`);
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error creating superuser:', error);
    process.exit(1);
  }
}

createSuperuser();
