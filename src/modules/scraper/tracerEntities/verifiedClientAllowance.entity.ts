import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('verified_client_allowance')
export class VerifiedClientAllowance {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    clientId: string;

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
