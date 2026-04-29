import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JobListing } from './job-listing.entity';

export enum JobApplicationStatus {
  Saved = 'saved',
  Applied = 'applied',
  Interviewing = 'interviewing',
  Offered = 'offered',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn',
}

@Entity('job_applications')
export class JobApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  jobListingId: string;

  @ManyToOne(() => JobListing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobListingId' })
  jobListing: JobListing;

  @Column({
    type: 'enum',
    enum: JobApplicationStatus,
    default: JobApplicationStatus.Saved,
  })
  status: JobApplicationStatus;

  @Column({ type: 'timestamp', nullable: true })
  appliedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  customCvId: string;

  @Column({ type: 'uuid', nullable: true })
  customCoverLetterId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  atsApplicationId: string;

  @Column({ type: 'timestamp', nullable: true })
  atsSubmittedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  generatedResumeContent: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  generatedCoverLetterContent: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}














