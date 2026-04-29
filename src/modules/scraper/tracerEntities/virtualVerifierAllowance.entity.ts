import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('virtual_verifier_allowance')
export class VirtualVerifierAllowance {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    verifierId: string;

    @Column({ nullable: true })
    verifierAddressEth: string;

    @Column({ nullable: true })
    height: number;

    @Column({ type: 'numeric', nullable: true })
    allowance: string;

    @Column({ nullable: true })
    msgCid: string;

    @Column({ nullable: true })
    type: string;

    @Column({ nullable: true })
    dcSource: string;
}
