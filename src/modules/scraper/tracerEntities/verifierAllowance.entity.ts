import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('verifier_allowance')
export class VerifierAllowance {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    verifierId: string;

    @Column({ nullable: true })
    height: number;

    @Column({ type: 'numeric', nullable: true })
    allowance: string;

    @Column({ nullable: true })
    msgCid: string;

    @Column({ nullable: true })
    type: string;
}
