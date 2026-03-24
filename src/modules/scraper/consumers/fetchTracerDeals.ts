import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { TRACER_DB } from 'src/modules/database-config/tracer.providers';
import { Between, EntityManager, Repository } from 'typeorm';

import { Deal as TracerDeal } from '../tracerEntities/deal.entity';
import { SCRAPER_SECONDARY_DB } from 'src/modules/database-config/scraperSecondary.providers';

@Injectable()
export class FetchTracerDealsConsumer implements IConsumer {
    public queue = 'fetchTracerDeals';
    intervalSize = 1000;
    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,

        @InjectRepository(TracerDeal, TRACER_DB)
        private tracerDealRepository: Repository<TracerDeal>,

        @InjectEntityManager(SCRAPER_SECONDARY_DB)
        private entityManager: EntityManager,

    ) { }

    public async exec(msg: string, channel: Channel, brokerMsg: Message) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerDeals',
        );
        try {
            const message = JSON.parse(msg);
            const { startId, latestId } = message;

            const deals = await this.tracerDealRepository.query(`select d.*, a."contractImmediateCaller" from deals d left join allocations a on d."claimId"=a."allocationId" where d.id BETWEEN ${startId} AND ${Math.min(startId + this.intervalSize - 1, latestId)}`);
            Logger.log(
                `Fetched ${deals.length} deals from tracer DB for ids between ${startId} and ${Math.min(startId + this.intervalSize - 1, latestId)}`,
                'FetchTracerDeals',
            );

            await this.entityManager.query(
                `INSERT INTO unified_verified_deal ("claimId", type, "clientId", "providerId", "sectorId", "pieceCid", "pieceSize", "termMax", "termMin", "termStart", "dealId", "dcSource")
                    VALUES ${deals.map(a => `(${a.claimId}, 'claimFromTracer', ${a.contractImmediateCaller && a.contractImmediateCaller != 5 ? a.contractImmediateCaller : a.clientId}, ${a.providerId}, ${a.sectorId}, '${a.pieceCid}', ${a.pieceSize}, ${a.termMax}, ${a.termMin}, ${a.termStart}, ${a.dealId ? a.dealId : 0}, '${a.clientId}')`).join(', ')}
                    ON CONFLICT do nothing;`,
            );

            Logger.log(
                `Upserted ${deals.length} deals to scraper secondary DB for ids between ${startId} and ${Math.min(startId + this.intervalSize - 1, latestId)}`,
                'FetchTracerDeals',
            );

            channel.ack(brokerMsg);
        } catch (error) {
            Logger.error(
                `Error processing tracer deals: ${error.message}`,
                error.stack,
                'FetchTracerDeals',
            );
            channel.nack(brokerMsg, false, false);
        }
    }
}
