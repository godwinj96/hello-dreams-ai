import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ConversationStatus } from '../enums/conversation-status.enum';

@Entity('resume_conversations')
export class ResumeConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ nullable: true })
  title: string;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.Active,
  })
  status: ConversationStatus;

  @Column({ nullable: true })
  targetJobTitle: string;

  @Column({ nullable: true })
  targetIndustry: string;

  @OneToMany(
    () => require('./resume-message.entity').ResumeMessage,
    (message: any) => message.conversation,
    {
      cascade: true,
    },
  )
  messages: any[];

  @OneToOne(
    () => require('./resume.entity').Resume,
    (resume: any) => resume.conversation,
    {
      cascade: true,
      nullable: true,
    },
  )
  resume: any;

  @Column({ type: 'jsonb', default: [] })
  messagesJsonb: Array<{ role: string; content: string }>;

  @Column({ type: 'int', default: 0 })
  tokenCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
