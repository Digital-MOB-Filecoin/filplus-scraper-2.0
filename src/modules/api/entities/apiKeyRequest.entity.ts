import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ApiKeyRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable: true, unique: true})
  githubId: string;

  @Column({nullable: true})
  challenge: string;
}