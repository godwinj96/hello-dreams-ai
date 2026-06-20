import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type ContentType = 'resume' | 'document' | 'conversation' | 'profile';

@Entity('user_context_embeddings')
@Index(['userId', 'contentType', 'contentId'], { unique: true })
export class UserContextEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  contentType: ContentType;

  @Column()
  @Index()
  contentId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb' })
  embedding: number[]; // Stored as JSONB array of numbers

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
