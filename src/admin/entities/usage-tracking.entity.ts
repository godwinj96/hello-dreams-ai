import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('usage_tracking')
export class UsageTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  actionType: string;

  @Column()
  module: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  tokensUsed: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  costUsd: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  costNgn: number;

  @CreateDateColumn()
  createdAt: Date;
}


