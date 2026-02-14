import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { JobApplication } from './job-application.entity';

@Entity('job_listings')
export class JobListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  salary: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  jobType: string;

  @Column({ type: 'jsonb', nullable: true })
  skills: string[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  experienceLevel: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string;

  @Column({ type: 'text', nullable: true })
  sourceUrl: string;

  @Column({ type: 'timestamp', nullable: true })
  postedDate: Date;

  @Column({ type: 'numeric', nullable: true })
  matchScore: number;

  @Column({ type: 'jsonb', nullable: true })
  rawData: Record<string, any>;

  @OneToMany(() => JobApplication, (application) => application.jobListing)
  applications: JobApplication[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}













