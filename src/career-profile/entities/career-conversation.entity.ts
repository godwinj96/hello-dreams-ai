import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ConversationStatus } from '../../resume-builder/enums/conversation-status.enum';

@Entity('career_conversations')
export class CareerConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  title: string;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.Active,
  })
  status: ConversationStatus;

  @OneToMany(
    () => require('./career-message.entity').CareerMessage,
    (message: any) => message.conversation,
    {
      cascade: true,
    },
  )
  messages: any[];

  @Column({ type: 'jsonb', default: [] })
  messagesJsonb: Array<{ role: string; content: string }>;

  @Column({ type: 'int', default: 0 })
  tokenCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

