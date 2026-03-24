import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  EntityManager,
  Equal,
  In,
  IsNull,
  LessThan,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { AppConfig } from '../configuration/configuration.service';
import { LotusService } from '../lotus/lotus.service';
import { GlobalValues } from '../../../submodules/filecoin-plus-scraper-entities/globalValues.entity';
import { Verifier } from '../../../submodules/filecoin-plus-scraper-entities/verifier.entity';
import { VerifiedClient } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import {
  decodeEventParam,
  readObjectAsArray,
} from '../utils/util';

import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { VerifierAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { VerifierAllowance as TracerVerifierAllowance } from './tracerEntities/verifierAllowance.entity';
import { VerifiedClientAllowance as TracerVerifiedClientAllowance } from './tracerEntities/verifiedClientAllowance.entity';
import { Deal as TracerDeal } from './tracerEntities/deal.entity';

import { VerifiedClientAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';

import * as BN from 'bn.js';

import { Worker } from 'worker_threads';
import {
  logStringPrefix,
  workerThreadFilePath,
} from '../../workerThreads/config';
import { EventLog } from '../../../submodules/filecoin-plus-scraper-entities/eventLog.entity';
import { LotusArchiveService } from '../lotus-archive/lotus.service';

import Mailgun from 'mailgun.js';
import * as FormData from 'form-data';

import { ethers } from "ethers";
import { MetaAllocator } from 'submodules/filecoin-plus-scraper-entities/metaAllocator.entity';
import { ScraperUtilsService } from './utils/scraper.utils.service';
import { TRACER_DB } from '../database-config/tracer.providers';
import { SCRAPER_SECONDARY_DB } from '../database-config/scraperSecondary.providers';

@Injectable()
export class ScraperService {
  private mg = null;

  constructor(
    private httpService: HttpService,
    @InjectRepository(GlobalValues)
    private globalValuesRepository: Repository<GlobalValues>,
    @InjectRepository(EventLog)
    private eventLogRepository: Repository<EventLog>,
    @InjectRepository(Verifier)
    private verifiersRepository: Repository<Verifier>,
    @InjectRepository(VerifiedClient)
    private verifiedClientsRepository: Repository<VerifiedClient>,
    protected readonly config: AppConfig,

    protected lotus: LotusService,
    protected lotusArchive: LotusArchiveService,
    protected scraperUtils: ScraperUtilsService,

    @InjectRepository(VerifierAllowance)
    private verifierAllowanceRepository: Repository<VerifierAllowance>,
    @InjectRepository(VerifiedClientAllowance)
    private verifiedClientAllowanceRepository: Repository<VerifiedClientAllowance>,
    @InjectRepository(MetaAllocator)
    private metaAllocatorRepository: Repository<MetaAllocator>,

    @InjectRepository(TracerVerifierAllowance, TRACER_DB)
    private tracerVerifierAllowanceRepository: Repository<TracerVerifierAllowance>,

    @InjectRepository(TracerVerifiedClientAllowance, TRACER_DB)
    private tracerVerifiedClientAllowanceRepository: Repository<TracerVerifiedClientAllowance>,

    @InjectRepository(TracerDeal, TRACER_DB)
    private tracerDealRepository: Repository<TracerDeal>,

    @InjectRepository(GlobalValues, SCRAPER_SECONDARY_DB)
    private secondaryGlobalValuesRepository: Repository<GlobalValues>,

    @Inject('ASYNC_RABBITMQ_CONNECTION')
    protected readonly rabbitMQService: RabbitMQService,

    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {
    const mailgun = new Mailgun(FormData);
    this.mg = mailgun.client({
      username: 'api',
      key: this.config.values.mailgun.apiKey,
      url: 'https://api.eu.mailgun.net',
    });
  }

  async getGhApiLimits() {
    const limits = await this.httpService
      .get(`https://api.github.com/rate_limit`, {
        auth: {
          username: this.config.values.github.user,
          password: this.config.values.github.token,
        },
      })
      .toPromise();
    return limits.data;
  }

  //cron to get gh extra data
  async getAllowanceAuditTrail() {
    const allowances = await this.verifiedClientAllowanceRepository.find({
      where: {
        retries: MoreThan(0),
        verifierAddressId: Not('f0121877'),
      },
      take: 30,
    });

    await this.verifiedClientAllowanceRepository.update(
      {
        retries: MoreThan(0),
        verifierAddressId: 'f0121877',
      },
      {
        retries: 0,
      },
    );

    for (const allowance of allowances) {
      const res = await this.rabbitMQService.publish(
        'scraper',
        'getAllowanceAuditTrail',
        JSON.stringify({
          allowanceId: allowance.id,
          type: 'verifiedClient',
        }),
      );
    }

    if (allowances.length < 30) {
      const remainingApiRequests = 30 - allowances.length;

      const verifierAllowances = await this.verifierAllowanceRepository.find({
        where: {
          retries: MoreThan(0),
        },
        take: remainingApiRequests,
      });

      for (const allowance of verifierAllowances) {
        const res = await this.rabbitMQService.publish(
          'scraper',
          'getAllowanceAuditTrail',
          JSON.stringify({
            allowanceId: allowance.id,
            type: 'verifier',
          }),
        );
      }
    }
  }

  async refreshMinerList() {
    const entityManager = this.entityManager;
    try {
      await entityManager.query(`REFRESH MATERIALIZED VIEW unique_providers;`);
    } catch (e) {
      const type = e
        .toString()
        .indexOf('relation "unique_providers" does not exist');
      if (type !== -1) {
        await entityManager.query(`
          CREATE MATERIALIZED VIEW IF NOT EXISTS unique_providers
          AS select distinct "providerId" from unified_verified_deal;`);
      } else {
        console.log(e);
      }
    }
  }

  //------------------------------------------------------------------------------------------------------------------------------------------------
  async getSectorEvents() {
    // let encodedValue: any = Buffer.from(encode('sector-activated')).toString(
    //   'base64',
    // );
    // console.log('sector-activated', encodedValue);

    // encodedValue = Buffer.from(encode('sector-updated')).toString('base64');
    // console.log('sector-updated', encodedValue);

    const entityManager = this.entityManager;

    let dbHeightRecord = await this.globalValuesRepository.findOne({
      where: { key: 'sectorEventsLastCheckedHeight' },
    });

    let crtHeight = (await this.lotus.client.chain.getHead()).Height;
    const chainHeadHeight = crtHeight;

    //if height is less than 3855360, which is the nv22 upgrade epoch, return
    if (crtHeight < 3855360) {
      return;
    }

    let dbHeight = 0;

    if (!dbHeightRecord) {
      dbHeight = 3855360;

      dbHeightRecord = this.globalValuesRepository.create({
        key: 'sectorEventsLastCheckedHeight',
        value: dbHeight.toString(),
      });
    } else {
      dbHeight = +dbHeightRecord.value;
      // dbHeight = crtHeight - 1;
    }

    let heightDelta = 10;
    let heightDeltaRecord = await this.globalValuesRepository.findOne({
      where: { key: 'sectorHeightDelta' },
    });
    if (!heightDeltaRecord) {
      heightDeltaRecord = this.globalValuesRepository.create({
        key: 'sectorHeightDelta',
        value: heightDelta.toString(),
      });
    } else {
      heightDelta = +heightDeltaRecord.value;
    }

    if (dbHeight + heightDelta < crtHeight - 30) {
      crtHeight = dbHeight + heightDelta;
    } else {
      Logger.log('not enough height difference', 'GetSectorEvents');
      return;
    }
    // dbHeight = 4052053;
    // crtHeight = 4052063;
    Logger.log(
      `fetching events between ${dbHeight} and ${crtHeight}`,
      'GetSectorEvents',
    );

    let lotusInstance: any = this.lotusArchive;

    if (dbHeight > chainHeadHeight - 1999) {
      Logger.log('not using archive', 'GetSectorEvents');
      lotusInstance = this.lotus;
    }

    let response: any = null;
    try {
      response = await lotusInstance.httpConnector.request({
        method: 'Filecoin.GetActorEventsRaw',
        params: [
          {
            FromHeight: dbHeight,
            ToHeight: crtHeight,
            Fields: {
              $type: [
                {
                  Codec: 81,
                  Value: 'cHNlY3Rvci1hY3RpdmF0ZWQ=', //sector-activated
                },
                {
                  Codec: 81,
                  Value: 'bnNlY3Rvci11cGRhdGVk', //sector-updated
                },
              ],
            },
          },
        ],
      });
      if (response && response.length >= 10000) {
        throw new Error('too many events');
      }
    } catch (e) {
      console.log(e);
      heightDelta = heightDelta > 4 ? heightDelta - 2 : heightDelta;
      heightDeltaRecord.value = heightDelta.toString();
      await this.globalValuesRepository.save(heightDeltaRecord);
      Logger.log(e.toString(), 'GetSectorEvents');

      return;
    }

    let eventsBatch = [];
    let eventLogBatch = [];
    const eventsBatchSize = 500;

    Logger.log(
      `fetched ${response ? response.length : 'no-reponse'
      } events between ${dbHeight} and ${crtHeight}`,
      'GetSectorEvents',
    );
    if (response) {
      for (const event of response) {
        try {
          if (event.reverted === false) {
            const decodedEvent = {};

            for (const item of Object.entries(event.entries)) {
              const entry: any = item[1];

              decodedEvent[entry.Key] = decodeEventParam(
                entry.Value,
                +entry.Flags,
              );
            }

            if (decodedEvent && decodedEvent['$type']) {
              let eventHashId = `${event.msgCid['/']}`;

              eventLogBatch.push(
                this.eventLogRepository.create({
                  hashId: eventHashId,
                  msgCid: event.msgCid['/'],
                  tipsetKey: event.tipsetKey[0]['/'],
                  height: event.height,
                  reverted: event.reverted,
                  emitter: event.emitter,
                  entries: event.entries,
                  type: decodedEvent['$type'],
                  allocationClaimId: decodedEvent['id'],
                  backfilled: false,
                }),
              );
              eventsBatch.push({
                ...decodedEvent,
                provider: event.emitter,
                height: event.height,
              });
            }

            if (eventsBatch.length >= eventsBatchSize) {
              this.processSectorEventsBatch(
                entityManager,
                eventsBatch,
                eventLogBatch,
              );
              eventsBatch = [];
              eventLogBatch = [];
            }
          } else {
            // Logger.log('reverted event');
          }
        } catch (e) {
          Logger.log(`Error: ${e.toString()}`, 'GetSectorEvents');
        }
      }

      if (eventsBatch.length > 0) {
        this.processSectorEventsBatch(
          entityManager,
          eventsBatch,
          eventLogBatch,
        );
        eventsBatch = [];
        eventLogBatch = [];
      }

      Logger.log(
        `fetched events between ${dbHeight} and ${crtHeight}`,
        'GetSectorEvents',
      );
    }

    if (heightDelta < 10) {
      heightDeltaRecord.value = '10';
      await this.globalValuesRepository.save(heightDeltaRecord);
    }

    dbHeightRecord.value = crtHeight.toString();
    await this.globalValuesRepository.save(dbHeightRecord);
  }

  async processSectorEventsBatch(entityManager, eventsBatch, eventLogBatch) {
    // Logger.log('search for events in db');

    let eventsDb = [];
    if (eventLogBatch.length > 0) {
      eventsDb = await entityManager.query(`
              select "hashId"
              from event_log
              where exists(select hashid_vals
                           from (values ${eventLogBatch
          .map((event) => `('${event.hashId}')`)
          .join(`,`)}
                                ) as c(hashid_vals)
                           where hashid_vals = "hashId");
            `);
    }
    if (eventsDb.length == 0) {
      this.eventLogRepository.insert(eventLogBatch);
    } else {
      const eventsLogBatchFiltered = eventLogBatch.filter(
        (event) => !eventsDb.find((eventDb) => eventDb.hashId === event.hashId),
      );

      if (eventsLogBatchFiltered.length > 0) {
        this.eventLogRepository.insert(eventsLogBatchFiltered);
      }
    }

    // Logger.log('send batch to processing');
    await this.rabbitMQService.publish(
      'scraper',
      'processSectorEvent',
      JSON.stringify(eventsBatch),
    );
  }

  //------------------------------------------------------------------------------------------------------------------------------------------------

  async updateMultisigAddress() {
    const messagesToProcess = await this.verifiersRepository.find({
      where: { address: '' },
    });
    for (const message of messagesToProcess) {
      const res = await this.rabbitMQService.publish(
        'scraper',
        'updateMultisigAddress',
        JSON.stringify({
          address: message.addressId,
        }),
      );
    }
  }

  async updateAllowancesFromDataCapActor() {
    console.log('read f07');
    const dataCapActorState = await this.lotusArchive.client.state.readState(
      'f07',
    );

    const verifiedClients = await readObjectAsArray(
      dataCapActorState.State.Token.Balances,
      this.lotusArchive,
      9,
    );
    console.log('done reading f07');
    const verifiedClientIds = [];
    const tenPow18 = new BN(10).pow(new BN(18));

    for (const verifiedClient of verifiedClients) {
      const allowance = new BN(verifiedClient[1]).div(tenPow18);
      verifiedClientIds.push(verifiedClient[0]);
      await this.verifiedClientsRepository.update(
        { addressId: verifiedClient[0] },
        { allowance: allowance.toString() },
      );
    }
    await this.verifiedClientsRepository.update(
      { addressId: Not(In(verifiedClientIds)) },
      { allowance: '0' },
    );

    // const allowances = await readObjectAsArray(
    //   dataCapActorState.State.Token.Allowances,
    //   this.lotusBackup,
    //   9,
    // );
    // console.log(allowances);

    console.log('read f06');
    const verifiedRegistryActorState =
      await this.lotusArchive.client.state.readState('f06');

    const verifiers = await readObjectAsArray(
      verifiedRegistryActorState.State.Verifiers,
      this.lotusArchive,
      8,
    );
    const verifierIds = [];
    console.log('done reading f06');

    for (const verifier of verifiers) {
      verifierIds.push(verifier[0]);
      await this.verifiersRepository.update(
        { addressId: verifier[0], isVirtual: false },
        { allowance: verifier[1] },
      );
    }
    await this.verifiersRepository.update(
      { addressId: Not(In(verifierIds)), isVirtual: false },
      { allowance: 0 },
    );
  }

  async upsertDealData() {
    const chainHead = await this.lotus.client.chain.getHead();
    const lastBlockHeight = Number(chainHead.Height);

    const worker = new Worker(workerThreadFilePath, {
      workerData: { ...this.config.values.rabbitmq, lastBlockHeight, dealDataFilePath: this.config.values.dealDataFilePath },
    });
    worker.on('message', (message) =>
      console.log(`${logStringPrefix} on message`, message),
    );
    worker.on('error', (e) => console.log(`${logStringPrefix} on error`, e));
    worker.on('exit', async (code) => {
      console.log(
        `${logStringPrefix} on exit ${new Date().toISOString()}, code:`,
        code,
      );
    });
  }

  async getMetaAllocatorsFromFactory() {
    const lotusInstance: any = this.lotus;
    const metaAllocatorFactoryAbi = [
      {
        "type": "function",
        "name": "getContracts",
        "inputs": [],
        "outputs": [
          {
            "name": "contracts_",
            "type": "address[]",
            "internalType": "address[]"
          }
        ],
        "stateMutability": "view"
      },

    ];

    const ethProvider = new ethers.providers.JsonRpcProvider('https://api.node.glif.io/rpc/v1');

    const metaAllocatorFactory = new ethers.Contract('0x43f35309feAEE7F86AA007AEAfB64c602590d9F6', metaAllocatorFactoryAbi, ethProvider);

    const metaAlllocators = await metaAllocatorFactory.getContracts();

    for (const item of metaAlllocators) {
      const metaAllocator = item.toLowerCase();
      let metaAllocatorRecord = await this.metaAllocatorRepository.findOne({ where: { addressEth: metaAllocator } });
      if (!metaAllocatorRecord) {
        const filAddress = await lotusInstance.httpConnector.request({
          method: 'Filecoin.EthAddressToFilecoinAddress',
          params: [
            metaAllocator
          ],
        });

        const addressId = await this.scraperUtils.normalizeAddress(filAddress);

        metaAllocatorRecord = this.metaAllocatorRepository.create({
          addressEth: metaAllocator,
          address: filAddress,
          addressId: addressId,
        });
        await this.metaAllocatorRepository.save(metaAllocatorRecord);
      }

      await this.verifiersRepository.update({ addressId: metaAllocatorRecord.addressId }, { isMetaAllocator: true, addressEth: metaAllocator });
    }
  }

  async updateAllowancesFromMetaAllocator() {
    const metaAlllocators = await this.metaAllocatorRepository.find();
    const verifiers = [];
    for (const metaAllocator of metaAlllocators) {
      try {
        const virtualVerifiers = await this.updateAllowancesFromMetaAllocatorByAddress(metaAllocator.addressEth);
        verifiers.push(...virtualVerifiers);
      }
      catch (e) {
        Logger.log(
          `Failed to update balances for ${metaAllocator.addressEth}`,
          `UpdateAllowancesFromMetaAllocator`,
        );
      }
    }

    await this.verifiersRepository.update(
      { addressEth: Not(In(verifiers)), isVirtual: true },
      { allowance: 0 },
    );
  }

  async updateAllowancesFromMetaAllocatorByAddress(address: string) {
    const metaAllocatorAbi = [
      {
        "type": "function",
        "name": "allowance",
        "inputs": [
          {
            "name": "allocator",
            "type": "address",
            "internalType": "address"
          }
        ],
        "outputs": [
          {
            "name": "allowance_",
            "type": "uint256",
            "internalType": "uint256"
          }
        ],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "getAllocators",
        "inputs": [],
        "outputs": [
          {
            "name": "allocators",
            "type": "address[]",
            "internalType": "address[]"
          }
        ],
        "stateMutability": "view"
      }
    ];

    const ethProvider = new ethers.providers.JsonRpcProvider('https://api.node.glif.io/rpc/v1');

    const metaAllocator = new ethers.Contract(address, metaAllocatorAbi, ethProvider);

    const allocators = await metaAllocator.getAllocators();

    const verifierIds = [];

    for (const allocator of allocators) {
      const allowance = await metaAllocator.allowance(allocator);
      verifierIds.push(allocator.toLowerCase());
      await this.verifiersRepository.update(
        { addressEth: allocator.toLowerCase() },
        { allowance: allowance.toString() },
      );
    }

    return verifierIds;
  }

  async syncTracerVerifierAllowances() {
    const intervalSize = 3;
    // fetch last synced id from db
    let lastSyncedAllowance = await this.secondaryGlobalValuesRepository.findOne({ where: { key: 'lastSyncedTracerVerifierAllowanceId' } });
    if (!lastSyncedAllowance) {
      lastSyncedAllowance = this.secondaryGlobalValuesRepository.create({
        key: 'lastSyncedTracerVerifierAllowanceId',
        value: '0',
      });
    }
    const lastSyncedId = parseInt(lastSyncedAllowance.value);
    Logger.log(
      `Last synced tracer verifier allowance id: ${lastSyncedId}`,
      'SyncTracerVerifierAllowances',
    );

    // fetch the latest id from tracer db

    const latestAllowance = await this.tracerVerifierAllowanceRepository.maximum('id');
    const latestId = latestAllowance ? latestAllowance : 0;
    Logger.log(
      `Latest tracer verifier allowance id in the database: ${latestId}`,
      'SyncTracerVerifierAllowances',
    );

    // generate messages to fetch allowances for all ids between last synced and latest in batches of 1000
    let batchStartId = lastSyncedId + 1;

    while (batchStartId < latestId) {
      await this.rabbitMQService.publish(
        'scraper',
        'fetchTracerVerifierAllowances',
        JSON.stringify({ startId: batchStartId, latestId }),
      );

      Logger.log(
        `Published message to fetch tracer verifier allowances for ids between ${batchStartId} and latest ${latestId}`,
        'SyncTracerVerifierAllowances',
      );

      batchStartId += intervalSize;
    }

    lastSyncedAllowance.value = latestId.toString();
    await this.secondaryGlobalValuesRepository.save(lastSyncedAllowance);

    Logger.log(
      `Finished`,
      'SyncTracerVerifierAllowances',
    );
  }

  async syncTracerVerifiedClientAllowances() {
    const intervalSize = 3;
    // fetch last synced id from db
    let lastSyncedAllowance = await this.secondaryGlobalValuesRepository.findOne({ where: { key: 'lastSyncedTracerVerifiedClientAllowanceId' } });
    if (!lastSyncedAllowance) {
      lastSyncedAllowance = this.secondaryGlobalValuesRepository.create({
        key: 'lastSyncedTracerVerifiedClientAllowanceId',
        value: '0',
      });
    }
    const lastSyncedId = parseInt(lastSyncedAllowance.value);
    Logger.log(
      `Last synced tracer verified client allowance id: ${lastSyncedId}`,
      'SyncTracerVerifiedClientAllowances',
    );

    // fetch the latest id from tracer db

    const latestAllowance = await this.tracerVerifiedClientAllowanceRepository.maximum('id');
    const latestId = latestAllowance ? latestAllowance : 0;
    Logger.log(
      `Latest tracer verified client allowance id in the database: ${latestId}`,
      'SyncTracerVerifiedClientAllowances',
    );

    // generate messages to fetch allowances for all ids between last synced and latest in batches of 1000
    let batchStartId = lastSyncedId + 1;

    while (batchStartId < latestId) {
      await this.rabbitMQService.publish(
        'scraper',
        'fetchTracerVerifiedClientAllowances',
        JSON.stringify({ startId: batchStartId, latestId }),
      );

      Logger.log(
        `Published message to fetch tracer verified client allowances for ids between ${batchStartId} and latest ${latestId}`,
        'SyncTracerVerifiedClientAllowances',
      );

      batchStartId += intervalSize;
    }

    lastSyncedAllowance.value = latestId.toString();
    await this.secondaryGlobalValuesRepository.save(lastSyncedAllowance);

    Logger.log(
      `Finished`,
      'SyncTracerVerifiedClientAllowances',
    );
  }

  async syncTracerDeals() {
    const intervalSize = 1000;
    // fetch last synced id from db
    let lastSyncedDeal = await this.secondaryGlobalValuesRepository.findOne({ where: { key: 'lastSyncedTracerDealId' } });
    if (!lastSyncedDeal) {
      lastSyncedDeal = this.secondaryGlobalValuesRepository.create({
        key: 'lastSyncedTracerDealId',
        value: '0',
      });
    }
    const lastSyncedId = parseInt(lastSyncedDeal.value);
    Logger.log(
      `Last synced tracer deal id: ${lastSyncedId}`,
      'SyncTracerDeals',
    );

    // fetch the latest id from tracer db

    const latestDeal = await this.tracerDealRepository.maximum('id');
    const latestId = latestDeal ? latestDeal : 0;
    Logger.log(
      `Latest tracer deal id in the database: ${latestId}`,
      'SyncTracerDeals',
    );

    // generate messages to fetch deals for all ids between last synced and latest in batches of 1000
    let batchStartId = lastSyncedId + 1;

    while (batchStartId < latestId) {
      await this.rabbitMQService.publish(
        'scraper',
        'fetchTracerDeals',
        JSON.stringify({ startId: batchStartId, latestId }),
      );

      Logger.log(
        `Published message to fetch tracer deals for ids between ${batchStartId} and latest ${latestId}`,
        'SyncTracerDeals',
      );

      batchStartId += intervalSize;
    }

    lastSyncedDeal.value = latestId.toString();
    await this.secondaryGlobalValuesRepository.save(lastSyncedDeal);

    Logger.log(
      `Finished`,
      'SyncTracerDeals',
    );
  }
}
