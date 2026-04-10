import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { TRACER_DB } from 'src/modules/database-config/tracer.providers';
import { Between, EntityManager, Repository } from 'typeorm';

import { VerifiedClientAllowance as TracerVerifiedClientAllowance } from '../tracerEntities/verifiedClientAllowance.entity';
import { VerifiedClient } from 'submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import { VerifiedClientAllowance } from 'submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';

import { LotusArchiveService } from 'src/modules/lotus-archive/lotus.service';
import { Verifier } from 'submodules/filecoin-plus-scraper-entities/verifier.entity';
import { ClientContract } from 'submodules/filecoin-plus-scraper-entities/clientContract.entity';

@Injectable()
export class FetchTracerVerifiedClientAllowancesConsumer implements IConsumer {
    public queue = 'fetchTracerVerifiedClientAllowances';
    intervalSize = 100;
    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,

        @InjectRepository(TracerVerifiedClientAllowance, TRACER_DB)
        private tracerVerifiedClientAllowanceRepository: Repository<TracerVerifiedClientAllowance>,

        @InjectRepository(VerifiedClientAllowance)
        private verifiedClientAllowanceRepository: Repository<VerifiedClientAllowance>,

        @InjectRepository(VerifiedClient)
        private verifiedClientsRepository: Repository<VerifiedClient>,

        @InjectRepository(Verifier)
        private verifiersRepository: Repository<Verifier>,

        @InjectRepository(ClientContract)
        private clientContractsRepository: Repository<ClientContract>,

        @InjectEntityManager()
        private entityManager: EntityManager,

        protected lotusArchive: LotusArchiveService,
    ) { }

    public async exec(msg: string, channel: Channel, brokerMsg: Message) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerVerifiedClientAllowances',
        );
        try {
            const message = JSON.parse(msg);
            const { startId, latestId } = message;

            const allowances = await this.tracerVerifiedClientAllowanceRepository.find({ where: { id: Between(startId, Math.min(startId + this.intervalSize - 1, latestId)) } });
            Logger.log(
                `Fetched ${allowances.length} allowances from tracer DB for ids between ${startId} and ${Math.min(startId + this.intervalSize - 1, latestId)}`,
                'FetchTracerVerifiedClientAllowances',
            );

            let lotusInstance: any = this.lotusArchive;

            const networkVersion = await lotusInstance.httpConnector.request({
                method: 'Filecoin.StateNetworkVersion',
                params: [null
                ],
            });

            const actorCids = await lotusInstance.httpConnector.request({
                method: 'Filecoin.StateActorCodeCIDs',
                params: [networkVersion
                ],
            });

            const ethAccountActorCid = actorCids.account["/"];
            const accountActorCid = actorCids.ethaccount["/"];

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

            const clientContractsDb = await this.clientContractsRepository.find();
            const clientContractsDictionary = {};
            for (const clientContract of clientContractsDb) {
                clientContractsDictionary[clientContract.addressId] = clientContract;
            }

            for (const allowance of allowances) {
                const existing = await this.verifiedClientAllowanceRepository.findOne({
                    where: {
                        addressId: `f0${allowance.clientId}`,
                        verifierAddressId: `f0${allowance.verifierId}`,
                        height: allowance.height,
                        msgCID: allowance.msgCid
                    }
                });
                if (!existing) {
                    const newAllowance = this.verifiedClientAllowanceRepository.create({
                        addressId: `f0${allowance.clientId}`,
                        verifierAddressId: `f0${allowance.verifierId}`,
                        allowance: Number(allowance.allowance),
                        height: allowance.height,
                        msgCID: allowance.msgCid
                    });
                    await this.verifiedClientAllowanceRepository.save(newAllowance);

                    // Ensure the verified client exists
                    let verifiedClient = await this.verifiedClientsRepository.findOne({ where: { addressId: `f0${allowance.clientId}`, verifierAddressId: `f0${allowance.verifierId}` } });
                    if (!verifiedClient) {
                        let address = '';
                        try {
                            address = await this.lotusArchive.client.state.accountKey(`f0${allowance.clientId}`);
                        }
                        catch (e: any) {

                        }

                        let isAccount = true;
                        let isAllowanceFromClientContract = false;

                        if (allowance.type == 'contract') {
                            isAllowanceFromClientContract = true;
                        }

                        if (!isAllowanceFromClientContract) {
                            try {
                                const actor = await this.lotusArchive.httpConnector.request({
                                    method: 'Filecoin.StateGetActor', params: [
                                        `f0${allowance.clientId}`,
                                        null,
                                    ]
                                });

                                if (actor["Code"]['/'] !== ethAccountActorCid && actor["Code"]['/'] !== accountActorCid) {
                                    isAccount = false;
                                }
                            }
                            catch (e: any) {

                            }
                        } else if (isAllowanceFromClientContract) {
                            isAccount = false;
                        }

                        verifiedClient = new VerifiedClient();
                        verifiedClient.isAccount = isAccount;
                        verifiedClient.addressId = `f0${allowance.clientId}`;
                        verifiedClient.address = address;
                        verifiedClient.initialAllowance = Number(allowance.allowance);
                        verifiedClient.allowance = `${allowance.allowance}`;
                        verifiedClient.verifierAddressId = `f0${allowance.verifierId}`;
                        verifiedClient.createdAtHeight = allowance.height;
                        verifiedClient.createMessageTimestamp =
                            1598306400 + allowance.height * 30;

                        verifiedClient.auditTrail = 'n/a';
                    } else {
                        let updatedAllowance = BigInt(verifiedClient.initialAllowance);
                        updatedAllowance = updatedAllowance + BigInt(allowance.allowance);

                        verifiedClient.initialAllowance = Number(updatedAllowance);
                        verifiedClient.createdAtHeight = allowance.height;
                        verifiedClient.createMessageTimestamp =
                            1598306400 + allowance.height * 30;
                    }

                    await this.verifiedClientsRepository.save(verifiedClient);
                }
            }

            Logger.log(
                `Upserted ${allowances.length} allowances to scraper secondary DB for ids between ${startId} and ${Math.min(startId + this.intervalSize - 1, latestId)}`,
                'FetchTracerVerifiedClientAllowances',
            );

            channel.ack(brokerMsg);
        } catch (error: any) {
            Logger.error(
                `Error processing tracer verified client allowances: ${error.message}`,
                error.stack,
                'FetchTracerVerifiedClientAllowances',
            );
            channel.nack(brokerMsg, false, false);
        }
    }
}
