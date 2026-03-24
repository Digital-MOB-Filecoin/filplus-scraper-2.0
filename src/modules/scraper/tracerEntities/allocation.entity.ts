import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('allocations')
export class Allocation {
    @PrimaryColumn()
    allocationId: number;

    @Column({ nullable: true })
    clientId: number;

    @Column({ nullable: true })
    providerId: number;

    @Column({ nullable: true })
    pieceCid: string;

    @Column({ type: 'numeric', nullable: true })
    pieceSize: string;

    @Column({ nullable: true })
    termMax: number;

    @Column({ nullable: true })
    termMin: number;

    @Column({ nullable: true })
    expiration: number;

    @Column({ nullable: true })
    contractImmediateCaller: number;
}
