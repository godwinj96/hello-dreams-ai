import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DocumentConversation } from './document-conversation.entity';
import { DocumentType } from '../enums/document-type.enum';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  conversationId: string;

  @OneToOne(
    () => DocumentConversation,
    (conversation) => conversation,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'conversationId' })
  conversation: DocumentConversation;

  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column('text')
  content: string;

  @Column({ default: 1 })
  version: number;

  @Column({ nullable: true })
  targetJobTitle: string;

  @Column({ nullable: true })
  targetCompany: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

