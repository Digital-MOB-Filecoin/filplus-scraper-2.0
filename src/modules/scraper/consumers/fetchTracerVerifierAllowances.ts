import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { TRACER_DB } from 'src/modules/database-config/tracer.providers';
import { Between, EntityManager, Repository } from 'typeorm';

import { VerifierAllowance as TracerVerifierAllowance } from '../tracerEntities/verifierAllowance.entity';
import { VerifierAllowance } from 'submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { Verifier } from 'submodules/filecoin-plus-scraper-entities/verifier.entity';
import { VerifiedClient } from 'submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import { LotusArchiveService } from 'src/modules/lotus-archive/lotus.service';

@Injectable()
export class FetchTracerVerifierAllowancesConsumer implements IConsumer {
    public queue = 'fetchTracerVerifierAllowances';
    intervalSize = 100;
    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,

        @InjectRepository(TracerVerifierAllowance, TRACER_DB)
        private tracerVerifierAllowanceRepository: Repository<TracerVerifierAllowance>,

        @InjectRepository(VerifierAllowance)
        private verifierAllowanceRepository: Repository<VerifierAllowance>,

        @InjectRepository(VerifiedClient)
        private verifiedClientsRepository: Repository<VerifiedClient>,

        @InjectRepository(Verifier)
        private verifiersRepository: Repository<Verifier>,

        @InjectEntityManager()
        private entityManager: EntityManager,

        protected lotusArchive: LotusArchiveService,


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

            const metaAllocatorsDictionary = {};
            const virtualVerifiersList = [];
            const verifiersDb = await this.verifiersRepository.find();
            for (const verifier of verifiersDb) {
                if (verifier.isMetaAllocator) {
                    metaAllocatorsDictionary[verifier.addressId] = verifier;
                }
                if (verifier.isVirtual) {
                    virtualVerifiersList.push(verifier);
                }
            }

            for (const allowance of allowances) {
                let existing = await this.verifierAllowanceRepository.findOne({ where: { addressId: `f0${allowance.verifierId}`, msgCID: allowance.msgCid } });
                if (!existing) {
                    const newAllowance = this.verifierAllowanceRepository.create({
                        addressId: `f0${allowance.verifierId}`,
                        height: allowance.height,
                        createMessageTimestamp: 1598306400 + allowance.height * 30,
                        msgCID: allowance.msgCid,
                        allowance: Number(allowance.allowance),
                        isVirtual: allowance.type === 'meta-allocator'
                    });
                    await this.verifierAllowanceRepository.save(newAllowance);
                }

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
                    if (allowance.type === 'meta-allocator') {
                        verifier.isVirtual = true;
                        // verifier.addressEth = dcVerifierUpdate.verifierAddressEth;
                        // verifier.dcSource = dcVerifierUpdate.dcSource;
                    }

                } else {
                    let updatedAllowance = BigInt(verifier.initialAllowance);
                    updatedAllowance = updatedAllowance +
                        BigInt(allowance.allowance);

                    verifier.initialAllowance = Number(updatedAllowance);

                    if (allowance.type === 'meta-allocator') {
                        verifier.isVirtual = true;
                        // verifier.addressEth = dcVerifierUpdate.verifierAddressEth;
                    }
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

            channel.ack(brokerMsg);
        } catch (error: any) {
            Logger.error(
                `Error processing tracer verifier allowances: ${error.message}`,
                error.stack,
                'FetchTracerVerifierAllowances',
            );
            channel.nack(brokerMsg, false, false);
        }
    }
}
