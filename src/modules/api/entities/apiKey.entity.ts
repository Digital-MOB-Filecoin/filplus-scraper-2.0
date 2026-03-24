import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, unique: true })
  githubId: string;

  @Column({ nullable: true })
  key: string;

  @Column({ default: false })
  isAdmin: boolean;
}
