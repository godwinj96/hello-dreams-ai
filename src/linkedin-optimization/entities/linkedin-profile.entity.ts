import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('linkedin_profiles')
export class LinkedInProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'jsonb', nullable: true })
  headline: {
    options?: string[];
    selected?: string;
  };

  @Column({ type: 'text', nullable: true })
  about: string;

  @Column({ type: 'jsonb', nullable: true })
  topSkills: string[];

  @Column({ type: 'jsonb', nullable: true })
  experience: Array<{
    jobTitle: string;
    company: string;
    dates?: string;
    bullets: string[];
  }>;

  @Column({ type: 'jsonb', nullable: true })
  education: Array<{
    degree: string;
    institution: string;
    dates?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  certifications: Array<{
    name: string;
    issuingOrganization?: string;
    date?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  skills: string[];

  @Column({ type: 'jsonb', nullable: true })
  volunteering: Array<{
    organization: string;
    role: string;
    description?: string;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
