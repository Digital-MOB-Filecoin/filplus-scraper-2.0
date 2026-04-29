import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { TRACER_DB } from 'src/modules/database-config/tracer.providers';
import { Between, EntityManager, Repository } from 'typeorm';

import { VerifierAllowance } from 'submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { Verifier } from 'submodules/filecoin-plus-scraper-entities/verifier.entity';
import { LotusArchiveService } from 'src/modules/lotus-archive/lotus.service';
import { VirtualVerifierAllowance } from '../tracerEntities/virtualVerifierAllowance.entity';

@Injectable()
export class FetchTracerVirtualVerifierAllowancesConsumer implements IConsumer {
    public queue = 'fetchTracerVirtualVerifierAllowances';
    intervalSize = 100;
    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,

        @InjectRepository(VirtualVerifierAllowance, TRACER_DB)
        private tracerVirtualVerifierAllowanceRepository: Repository<VirtualVerifierAllowance>,

        @InjectRepository(VerifierAllowance)
        private verifierAllowanceRepository: Repository<VerifierAllowance>,

        @InjectRepository(Verifier)
        private verifiersRepository: Repository<Verifier>,

        protected lotusArchive: LotusArchiveService,


    ) { }

    public async exec(msg: string, channel: Channel, brokerMsg: Message) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerVirtualVerifierAllowances',
        );

        try {
            const message = JSON.parse(msg);
            const { startId, latestId } = message;

            const allowances = await this.tracerVirtualVerifierAllowanceRepository.find({ where: { id: Between(startId, Math.min(startId + this.intervalSize - 1, latestId)) } });

            for (const allowance of allowances) {
                let existing = await this.verifierAllowanceRepository.findOne({ where: { addressId: `f0${allowance.verifierId}`, msgCID: allowance.msgCid } });
                if (!existing) {
                    const newAllowance = this.verifierAllowanceRepository.create({
                        addressId: `f0${allowance.verifierId}`,
                        height: allowance.height,
                        createMessageTimestamp: 1598306400 + allowance.height * 30,
                        msgCID: allowance.msgCid,
                        allowance: Number(allowance.allowance),
                        isVirtual: true
                    });
                    await this.verifierAllowanceRepository.save(newAllowance);

                    let verifier = await this.verifiersRepository.findOne({ where: { addressId: `f0${allowance.verifierId}` } });

                    if (!verifier) {
                        let address = '';
                        try {
                            address = await this.lotusArchive.client.state.accountKey(`f0${allowance.verifierId}`);
                        }
                        catch (e) {

                        }

                        verifier = new Verifier();
                        verifier.addressId = `f0${allowance.verifierId}`;
                        verifier.address = address;
                        verifier.initialAllowance = Number(allowance.allowance);
                        verifier.allowance = Number(allowance.allowance);
                        verifier.createdAtHeight = allowance.height;
                        verifier.createMessageTimestamp = 1598306400 + allowance.height * 30;
                        verifier.isMultisig = false;
                        verifier.auditTrail = 'n/a';
                        verifier.isVirtual = true;
                        verifier.dcSource = allowance.dcSource;
                        verifier.addressEth = allowance.verifierAddressEth;

                    } else {
                        let updatedAllowance = BigInt(verifier.initialAllowance);
                        updatedAllowance = updatedAllowance +
                            BigInt(allowance.allowance);

                        verifier.initialAllowance = Number(updatedAllowance);
                        verifier.isVirtual = true;
                    }
                    await this.verifiersRepository.save(verifier);

                    if (verifier.address == '') {
                        const res = await this.rabbitMQService.publish(
                            'scraper',
                            'updateMultisigAddress',
                            JSON.stringify({
                                address: verifier.addressId,
                            }),
                        );
                    }
                }
            }

            channel.ack(brokerMsg);
        } catch (error: any) {
            Logger.error(
                `Error processing tracer virtual verifier allowances: ${error.message}`,
                error.stack,
                'FetchTracerVirtualVerifierAllowances',
            );
            channel.nack(brokerMsg, false, false);
        }
    }
}
