import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class BackfillRanges {
  @PrimaryColumn()
  hashId: string;

  @Column()
  start: number;

  @Column()
  end: number;

  @Column()
  crt: number;

  @Column({ nullable: true })
  crtForProcessing: number;
}
