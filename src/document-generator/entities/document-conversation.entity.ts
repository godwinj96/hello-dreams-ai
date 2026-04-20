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
import { DocumentType } from '../enums/document-type.enum';

@Entity('document_conversations')
export class DocumentConversation {
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
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.Active,
  })
  status: ConversationStatus;

  @Column({ nullable: true })
  targetJobTitle: string;

  @Column({ nullable: true })
  targetCompany: string;

  @Column({ nullable: true })
  jobDescription: string;

  @OneToMany(
    () => require('./document-message.entity').DocumentMessage,
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

