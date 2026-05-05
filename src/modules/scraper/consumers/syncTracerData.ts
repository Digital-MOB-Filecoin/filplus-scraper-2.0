import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { TRACER_DB } from 'src/modules/database-config/tracer.providers';
import { Between, EntityManager, Repository } from 'typeorm';

import { Deal as TracerDeal } from '../tracerEntities/deal.entity';
import { VerifiedClientAllowance as TracerVerifiedClientAllowance } from '../tracerEntities/verifiedClientAllowance.entity';
import { VerifierAllowance as TracerVerifierAllowance } from '../tracerEntities/verifierAllowance.entity';
import { VirtualVerifiedClientAllowance } from '../tracerEntities/virtualVerifiedClientAllowance.entity';
import { VirtualVerifierAllowance } from '../tracerEntities/virtualVerifierAllowance.entity';

import { VerifiedClient } from 'submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import { VerifiedClientAllowance } from 'submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';
import { Verifier } from 'submodules/filecoin-plus-scraper-entities/verifier.entity';
import { VerifierAllowance } from 'submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { ClientContract } from 'submodules/filecoin-plus-scraper-entities/clientContract.entity';
import { LotusArchiveService } from 'src/modules/lotus-archive/lotus.service';

@Injectable()
export class SyncTracerDataConsumer implements IConsumer {
    public queue = 'syncTracerData';
    dealsIntervalSize = 1000;
    intervalSize = 1000;

    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,

        @InjectRepository(TracerDeal, TRACER_DB)
        private tracerDealRepository: Repository<TracerDeal>,

        @InjectRepository(TracerVerifiedClientAllowance, TRACER_DB)
        private tracerVerifiedClientAllowanceRepository: Repository<TracerVerifiedClientAllowance>,

        @InjectRepository(TracerVerifierAllowance, TRACER_DB)
        private tracerVerifierAllowanceRepository: Repository<TracerVerifierAllowance>,

        @InjectRepository(VirtualVerifiedClientAllowance, TRACER_DB)
        private tracerVirtualVerifiedClientAllowanceRepository: Repository<VirtualVerifiedClientAllowance>,

        @InjectRepository(VirtualVerifierAllowance, TRACER_DB)
        private tracerVirtualVerifierAllowanceRepository: Repository<VirtualVerifierAllowance>,

        @InjectRepository(VerifiedClientAllowance)
        private verifiedClientAllowanceRepository: Repository<VerifiedClientAllowance>,

        @InjectRepository(VerifiedClient)
        private verifiedClientsRepository: Repository<VerifiedClient>,

        @InjectRepository(Verifier)
        private verifiersRepository: Repository<Verifier>,

        @InjectRepository(VerifierAllowance)
        private verifierAllowanceRepository: Repository<VerifierAllowance>,

        @InjectRepository(ClientContract)
        private clientContractsRepository: Repository<ClientContract>,

        @InjectEntityManager()
        private entityManager: EntityManager,

        protected lotusArchive: LotusArchiveService,
    ) { }

    public async exec(msg: string, channel: Channel, brokerMsg: Message) {
        Logger.log(
            `Processing message: ${msg}`,
            'SyncTracerData',
        );
        const message = JSON.parse(msg);

        try {
            if (message.type == 'fetchTracerDeals') {
                await this.syncTracerDeals(message.msg);
            }
            if (message.type == 'fetchTracerVerifiedClientAllowances') {
                await this.syncTracerVerifiedClientAllowances(message.msg);
            }
            if (message.type == 'fetchTracerVerifierAllowances') {
                await this.syncTracerVerifierAllowances(message.msg);
            }
            if (message.type == 'fetchTracerVirtualVerifiedClientAllowances') {
                await this.syncTracerVirtualVerifiedClientAllowances(message.msg);
            }
            if (message.type == 'fetchTracerVirtualVerifierAllowances') {
                await this.syncTracerVirtualVerifierAllowances(message.msg);
            }

            channel.ack(brokerMsg);
        } catch (error: any) {
            Logger.error(
                `Error processing sync tracer data: ${error.message}`,
                error.stack,
                'SyncTracerData',
            );
            channel.nack(brokerMsg, false, false);
        }
    }

    public async syncTracerDeals(msg: string) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerDeals',
        );

        const message: any = msg;
        const { startId, latestId } = message;

        const deals = await this.tracerDealRepository.query(`select d.*, a."contractImmediateCaller" from deals d left join allocations a on d."claimId"=a."allocationId" where d.id BETWEEN ${startId} AND ${Math.min(startId + this.dealsIntervalSize - 1, latestId)}`);
        Logger.log(
            `Fetched ${deals.length} deals from tracer DB for ids between ${startId} and ${Math.min(startId + this.dealsIntervalSize - 1, latestId)}`,
            'FetchTracerDeals',
        );

        if (deals.length > 0) {
            await this.entityManager.query(
                `INSERT INTO unified_verified_deal ("claimId", type, "clientId", "providerId", "sectorId", "pieceCid", "pieceSize", "termMax", "termMin", "termStart", "dealId", "dcSource")
                VALUES ${deals.map(a => `(${a.claimId}, 'claimFromTracer', ${a.contractImmediateCaller && a.contractImmediateCaller != 5 ? a.contractImmediateCaller : a.clientId}, ${a.providerId}, ${a.sectorId}, '${a.pieceCid}', ${a.pieceSize}, ${a.termMax}, ${a.termMin}, ${a.termStart}, ${a.dealId ? a.dealId : 0}, '${a.clientId}')`).join(', ')}
                ON CONFLICT do nothing;`,
            );
        }
        Logger.log(
            `Upserted ${deals.length} deals to scraper secondary DB for ids between ${startId} and ${Math.min(startId + this.dealsIntervalSize - 1, latestId)}`,
            'FetchTracerDeals',
        );
    }

    public async syncTracerVerifiedClientAllowances(msg: string) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerVerifiedClientAllowances',
        );

        const message: any = msg;
        const { startId, latestId } = message;

        const allowances = await this.tracerVerifiedClientAllowanceRepository.find({ where: { id: Between(startId, Math.min(startId + this.intervalSize - 1, latestId)) } });
        Logger.log(
            `Fetched ${allowances.length} allowances from tracer DB for ids between ${startId} and ${Math.min(startId + this.intervalSize - 1, latestId)}`,
            'FetchTracerVerifiedClientAllowances',
        );

        const lotusInstance: any = this.lotusArchive;

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

        const ethAccountActorCid = actorCids.account['/'];
        const accountActorCid = actorCids.ethaccount['/'];

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
                    msgCID: allowance.msgCid,
                },
            });
            if (!existing) {
                const newAllowance = this.verifiedClientAllowanceRepository.create({
                    addressId: `f0${allowance.clientId}`,
                    verifierAddressId: `f0${allowance.verifierId}`,
                    allowance: Number(allowance.allowance),
                    height: allowance.height,
                    msgCID: allowance.msgCid,
                });
                await this.verifiedClientAllowanceRepository.save(newAllowance);

                let verifiedClient = await this.verifiedClientsRepository.findOne({ where: { addressId: `f0${allowance.clientId}`, verifierAddressId: `f0${allowance.verifierId}` } });
                if (!verifiedClient) {
                    let address = '';
                    try {
                        address = await this.lotusArchive.client.state.accountKey(`f0${allowance.clientId}`);
                    } catch (e: any) {
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
                                ],
                            });

                            if (actor['Code']['/'] !== ethAccountActorCid && actor['Code']['/'] !== accountActorCid) {
                                isAccount = false;
                            }
                        } catch (e: any) {
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
    }

    public async syncTracerVerifierAllowances(msg: string) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerVerifierAllowances',
        );

        const message: any = msg;
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
            const existing = await this.verifierAllowanceRepository.findOne({ where: { addressId: `f0${allowance.verifierId}`, msgCID: allowance.msgCid } });
            if (!existing) {
                const newAllowance = this.verifierAllowanceRepository.create({
                    addressId: `f0${allowance.verifierId}`,
                    height: allowance.height,
                    createMessageTimestamp: 1598306400 + allowance.height * 30,
                    msgCID: allowance.msgCid,
                    allowance: Number(allowance.allowance),
                    isVirtual: false,
                });
                await this.verifierAllowanceRepository.save(newAllowance);
            }

            let verifier = await this.verifiersRepository.findOne({ where: { addressId: `f0${allowance.verifierId}` } });

            if (!verifier) {
                let address = '';
                try {
                    address = await this.lotusArchive.client.state.accountKey(`f0${allowance.verifierId}`);
                } catch (e) {
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
                verifier.isVirtual = false;
            } else {
                let updatedAllowance = BigInt(verifier.initialAllowance);
                updatedAllowance = updatedAllowance +
                    BigInt(allowance.allowance);

                verifier.initialAllowance = Number(updatedAllowance);
                verifier.isVirtual = false;
            }
            await this.verifiersRepository.save(verifier);

            if (verifier.address == '') {
                await this.rabbitMQService.publish(
                    'scraper',
                    'updateMultisigAddress',
                    JSON.stringify({
                        address: verifier.addressId,
                    }),
                );
            }
        }
    }

    public async syncTracerVirtualVerifiedClientAllowances(msg: string) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerVirtualVerifiedClientAllowances',
        );

        const message: any = msg;
        const { startId, latestId } = message;

        const allowances = await this.tracerVirtualVerifiedClientAllowanceRepository.find({ where: { id: Between(startId, Math.min(startId + this.intervalSize - 1, latestId)) } });
        Logger.log(
            `Fetched ${allowances.length} allowances from tracer DB for ids between ${startId} and ${Math.min(startId + this.intervalSize - 1, latestId)}`,
            'FetchTracerVirtualVerifiedClientAllowances',
        );

        const clientContractsDb = await this.clientContractsRepository.find();
        const clientContractsDictionary = {};
        for (const clientContract of clientContractsDb) {
            clientContractsDictionary[clientContract.addressId] = clientContract;
        }

        for (const allowance of allowances) {
            const allowanceExists = await this.verifiedClientAllowanceRepository.findOne({
                where: {
                    addressId: `f0${allowance.clientId}`,
                    verifierAddressId: `f0${allowance.verifierId}`,
                    height: allowance.height,
                    msgCID: allowance.msgCid,
                },
            });
            if (!allowanceExists) {
                const newAllowance = this.verifiedClientAllowanceRepository.create({
                    addressId: `f0${allowance.clientId}`,
                    verifierAddressId: `f0${allowance.verifierId}`,
                    allowance: Number(allowance.allowance),
                    height: allowance.height,
                    msgCID: allowance.msgCid,
                });
                await this.verifiedClientAllowanceRepository.save(newAllowance);

                let verifiedClient = await this.verifiedClientsRepository.findOne({ where: { addressId: `f0${allowance.clientId}`, verifierAddressId: `f0${allowance.verifierId}` } });
                if (!verifiedClient) {
                    let address = '';
                    try {
                        address = await this.lotusArchive.client.state.accountKey(`f0${allowance.clientId}`);
                    } catch (e: any) {
                    }

                    verifiedClient = new VerifiedClient();
                    verifiedClient.isAccount = false;
                    verifiedClient.addressId = `f0${allowance.clientId}`;
                    verifiedClient.address = address;
                    verifiedClient.initialAllowance = Number(allowance.allowance);
                    verifiedClient.allowance = `${allowance.allowance}`;
                    verifiedClient.verifierAddressId = `f0${allowance.verifierId}`;
                    verifiedClient.createdAtHeight = allowance.height;
                    verifiedClient.dcSource = allowance.dcSource;
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
    }

    public async syncTracerVirtualVerifierAllowances(msg: string) {
        Logger.log(
            `Processing message: ${msg}`,
            'FetchTracerVirtualVerifierAllowances',
        );

        const message: any = msg;
        const { startId, latestId } = message;

        const allowances = await this.tracerVirtualVerifierAllowanceRepository.find({ where: { id: Between(startId, Math.min(startId + this.intervalSize - 1, latestId)) } });

        for (const allowance of allowances) {
            const existing = await this.verifierAllowanceRepository.findOne({ where: { addressId: `f0${allowance.verifierId}`, msgCID: allowance.msgCid } });
            if (!existing) {
                const newAllowance = this.verifierAllowanceRepository.create({
                    addressId: `f0${allowance.verifierId}`,
                    height: allowance.height,
                    createMessageTimestamp: 1598306400 + allowance.height * 30,
                    msgCID: allowance.msgCid,
                    allowance: Number(allowance.allowance),
                    isVirtual: true,
                });
                await this.verifierAllowanceRepository.save(newAllowance);

                let verifier = await this.verifiersRepository.findOne({ where: { addressId: `f0${allowance.verifierId}` } });

                if (!verifier) {
                    let address = '';
                    try {
                        address = await this.lotusArchive.client.state.accountKey(`f0${allowance.verifierId}`);
                    } catch (e) {
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
                    await this.rabbitMQService.publish(
                        'scraper',
                        'updateMultisigAddress',
                        JSON.stringify({
                            address: verifier.addressId,
                        }),
                    );
                }
            }
        }
    }
}