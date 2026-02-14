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

@Entity('professional_profiles')
export class ProfessionalProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'jsonb', nullable: true })
  careerGoals: {
    targetRoles?: string[];
    targetIndustries?: string[];
    careerAspirations?: string;
    workStyle?: string;
    values?: string[];
    preferences?: Record<string, any>;
  };

  @Column({ type: 'jsonb', nullable: true })
  basicInfo: {
    name?: string;
    email?: string;
    phone?: string;
    country?: string;
    state?: string;
    city?: string;
    linkedIn?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  targetJob: {
    targetJobTitle?: string;
    careerGoal?: string;
    salaryExpectation?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  cvMetadata: {
    pastJobTitles?: string[];
    experienceLevel?: string;
    industries?: string[];
    keywords?: string[];
    workHistory?: Array<{
      jobTitle?: string;
      company?: string;
      duration?: string;
      responsibilities?: string[];
    }>;
  };

  @Column({ type: 'varchar', length: 20, nullable: true })
  interactionMode: 'text' | 'voice';

  @Column({ type: 'text', nullable: true })
  cvUploadUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  persona: {
    communicationStyle?: string;
    tone?: string;
    professionalVoice?: string;
    writingStyle?: string;
    personalityTraits?: string[];
    preferences?: Record<string, any>;
  };

  @Column({ type: 'jsonb', nullable: true })
  personaData: {
    currentPersona?: string;
    idealPersona?: string;
    transformationPath?: {
      fromPersona?: string;
      toPersona?: string;
      playbook?: {
        speakingStyle?: string[];
        dressingForImpact?: string[];
        workplaceBehaviour?: string[];
        meetingMastery?: string[];
        digitalPresence?: string[];
      };
    };
    appliedPersona?: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  extractedData: {
    background?: string;
    experience?: string;
    skills?: string[];
    achievements?: string[];
    education?: string;
    certifications?: string[];
    other?: Record<string, any>;
  };

  @Column({ type: 'jsonb', nullable: true })
  completedSections: {
    careerProfile?: boolean;
    persona?: boolean;
    resume?: boolean;
    coverLetter?: boolean;
    personalStatement?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

