import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity('resume_data')
export class ResumeData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  resumeId: string;

  @OneToOne(() => require('./resume.entity').Resume, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resumeId' })
  resume: any;

  @Column({ type: 'jsonb', nullable: true })
  contactInfo: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedIn?: string;
    github?: string;
    portfolio?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  workExperience: Array<{
    jobTitle: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    responsibilities?: string[];
    achievements?: string[];
    tools?: string[];
  }>;

  @Column({ type: 'jsonb', nullable: true })
  education: Array<{
    degree: string;
    institution: string;
    graduationYear?: number;
    honors?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  skills: {
    technical?: string[];
    soft?: string[];
    tools?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  certifications: Array<{
    name: string;
    issuingOrganization?: string;
    date?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  projects: Array<{
    name: string;
    description?: string;
    technologies?: string[];
  }>;

  @Column({ type: 'jsonb', nullable: true })
  languages: Array<{
    language: string;
    proficiency: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  achievements: Array<{
    title: string;
    description?: string;
    date?: string;
  }>;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  keyAchievements: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
