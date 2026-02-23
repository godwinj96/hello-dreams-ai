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

export enum HeadshotStyle {
  Corporate = 'corporate',
  Modern = 'modern',
  Executive = 'executive',
  Creative = 'creative',
}

export enum HeadshotPersonaType {
  ConfidentLeader = 'confident-leader',
  ApproachableExpert = 'approachable-expert',
  InnovativeThinker = 'innovative-thinker',
  TrustworthyProfessional = 'trustworthy-professional',
}

export enum HeadshotStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

@Entity('headshot_generations')
export class HeadshotGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text', nullable: true })
  originalImageUrl: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  style: HeadshotStyle;

  @Column({ type: 'varchar', length: 50, nullable: true })
  personaType: HeadshotPersonaType;

  @Column({ type: 'jsonb', nullable: true })
  generatedImages: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: HeadshotStatus.Pending,
  })
  status: HeadshotStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}














