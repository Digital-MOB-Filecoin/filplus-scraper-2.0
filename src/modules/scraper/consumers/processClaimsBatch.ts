import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';

@Injectable()
export class ProcessClaimsBatchConsumer implements IConsumer {
    public queue = 'processClaimsBatch';

    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,
        @InjectEntityManager()
        private entityManager: EntityManager,
    ) { }

    public async exec(msg: string, channel: Channel, brokerMsg: Message) {
        try {
            const message = JSON.parse(msg);
            const { batch, batchNumber, providerAddress } = message;

            await this.processBatch(batch, batchNumber, providerAddress);

            channel.ack(brokerMsg);
        } catch (e) {
            Logger.error(
                `Failed to process claims batch: ${e.message}`,
                e.stack,
                'ProcessClaimsBatch',
            );
            channel.ack(brokerMsg);
        }
    }

    /**
     * Process a batch of claims
     * @param batch - Array of claim objects
     * @param batchNumber - The batch number (0-indexed)
     * @param providerAddress - The provider address
     */
    private async processBatch(batch: any[], batchNumber: number, providerAddress: string): Promise<void> {
        const entityManager = this.entityManager;

        const claimIds = batch.map(claim => Number(claim.claimId));
        const dcAllocationClaimsDb = await entityManager.query(
            `SELECT "claimId" FROM unified_verified_deal WHERE "claimId" = ANY($1)`,
            [claimIds]
        );
        const existingClaimIds = new Set(dcAllocationClaimsDb.map((c) => c.claimId));

        const newClaims = batch.filter(claim => !existingClaimIds.has(Number(claim.claimId)));

        // Process new claims
        if (newClaims.length > 0) {
            await entityManager.query(
                `INSERT INTO unified_verified_deal ("claimId", type, "clientId", "providerId", "sectorId", "pieceCid", "pieceSize",
                                   "termMax", "termMin", "termStart", "dealId")
                values ${newClaims.map(e => `(${e.claimId}, 'claimFromApiBackfill', '${e.Client}', '${e.Provider}', '${e.Sector}', '${e.Data['/']}', ${e.Size}, ${e.TermMax}, ${e.TermMin}, ${e.TermStart}, 0)`).join(',')};`,
            );
        }
    }
}
