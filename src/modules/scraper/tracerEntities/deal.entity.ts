import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('deals')
export class Deal {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ default: 0 })
    dealId: number;

    @Column({ default: 0 })
    claimId: number;

    @Column({ nullable: true })
    clientId: number;

    @Column({ nullable: true })
    dcSource: number;

    @Column({ nullable: true })
    providerId: number;

    @Column({ nullable: true })
    sectorId: number;

    @Column({ nullable: true })
    pieceCid: string;

    @Column({ type: 'numeric', nullable: true })
    pieceSize: string;

    @Column({ nullable: true })
    termMax: number;

    @Column({ nullable: true })
    termMin: number;

    @Column({ nullable: true })
    termStart: number;

    @Column({ nullable: true })
    sectorExpiry: number;
}
