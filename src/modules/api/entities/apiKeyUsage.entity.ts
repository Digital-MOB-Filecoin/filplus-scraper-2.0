import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ApiKeyUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  route: string;

  @Column({ nullable: true })
  key: string;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  timestamp: number;

  @Column({ nullable: true })
  statusCode: number;

  @Column({ nullable: true })
  statusCodeClass: string;
}
