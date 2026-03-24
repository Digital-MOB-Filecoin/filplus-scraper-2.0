import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class TipsetKeyByHeight {
  @PrimaryColumn()
  height: number;

  @Column({ type: 'jsonb', default: {} })
  tipsetKey: object;
}
