import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
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
  @JoinColumn()
  resume: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
