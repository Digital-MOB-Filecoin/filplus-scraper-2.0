import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { TRACER_DB } from 'src/modules/database-config/tracer.providers';
import { Between, EntityManager, Repository } from 'typeorm';

import { VerifierAllowance as TracerVerifierAllowance } from '../tracerEntities/verifierAllowance.entity';
import { error, log } from 'console';
import { SCRAPER_SECONDARY_DB } from 'src/modules/database-config/scraperSecondary.providers';

@Injectable()
export class FetchTracerVerifierAllowancesConsumer implements IConsumer {
    public queue = 'fetchTracerVerifierAllowances';
    intervalSize = 3;
    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,

        @InjectRepository(TracerVerifierAllowance, TRACER_DB)
        private tracerVerifierAllowanceRepository: Repository<TracerVerifierAllowance>,

        @InjectEntityManager(SCRAPER_SECONDARY_DB)
        private entityManager: EntityManager,

    ) { }

    public async exec(msg: string, channel: Channel, brokerMsg: Message) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerVerifierAllowances',
        );
        try {
            const message = JSON.parse(msg);
            const { startId, latestId } = message;

            const allowances = await this.tracerVerifierAllowanceRepository.find({ where: { id: Between(startId, Math.min(startId + this.intervalSize - 1, latestId)) } });
            Logger.log(
                `Fetched ${allowances.length} allowances from tracer DB for ids between ${startId} and ${Math.min(startId + this.intervalSize - 1, latestId)}`,
                'FetchTracerVerifierAllowances',
            );

            await this.entityManager.query(
                `INSERT INTO "verifier_allowance" ("addressId", "allowance", "height", "msgCID")
                 VALUES ${allowances.map(a => `('f0${a.verifierId}', ${a.allowance}, ${a.height}, '${a.msgCid}')`).join(', ')}
                `,
            );
            Logger.log(
                `Upserted ${allowances.length} allowances to scraper secondary DB for ids between ${startId} and ${Math.min(startId + this.intervalSize - 1, latestId)}`,
                'FetchTracerVerifierAllowances',
            );

            channel.ack(brokerMsg);
        } catch (error) {
            Logger.error(
                `Error processing tracer verifier allowances: ${error.message}`,
                error.stack,
                'FetchTracerVerifierAllowances',
            );
            channel.nack(brokerMsg, false, false);
        }
    }
}
