import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, In, LessThan, Not, Repository } from 'typeorm';
import { AppConfig } from '../configuration/configuration.service';
import { LotusService } from '../lotus/lotus.service';
import { GlobalValues } from '../../../submodules/filecoin-plus-scraper-entities/globalValues.entity';
import { Verifier } from '../../../submodules/filecoin-plus-scraper-entities/verifier.entity';
import { VerifiedClient } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import { VerifiedClientAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';

import { VerifiedDeal } from '../../../submodules/filecoin-plus-scraper-entities/verifiedDeal.entity';
import { isNumber } from 'class-validator';
import * as BN from 'bn.js';
import { GlifDataCapRequest } from '../../../submodules/filecoin-plus-scraper-entities/glifDataCapRequest.entity';
import { GhDataCapRequest } from '../../../submodules/filecoin-plus-scraper-entities/ghDataCapRequest.entity';
import { GhIssue } from '../../../submodules/filecoin-plus-scraper-entities/ghIssue.entity';
import { ApiKeyRequest } from './entities/apiKeyRequest.entity';
import { v4 as uuidv4 } from 'uuid';
import { ApiKey } from './entities/apiKey.entity';
import { VerifierAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { StoreBotEventDto, DateIntervalDto } from './api.dto';
import { BotEvent } from '../../../submodules/filecoin-plus-scraper-entities/botEvent';
import { LotusBackupService } from '../lotus-backup/lotus-backup.service';
import {
  castToDates,
  validateStartDateWithEndDate,
} from './helpers/dateInterval';
import { VerifiedRegistryMessage } from '../../../submodules/filecoin-plus-scraper-entities/verifiedRegistryMessage';
import { CronRunningState } from '../../../submodules/filecoin-plus-scraper-entities/cronRunningState.entity';
import { READ_DB_WITH_TIMEOUT } from '../database-config/databaseReadOnlyWithTimeout.providers';

@Injectable()
export class ApiService {
  constructor(
    private httpService: HttpService,
    @InjectRepository(GlobalValues)
    private globalValuesRepository: Repository<GlobalValues>,
    @InjectRepository(Verifier)
    private verifiersRepository: Repository<Verifier>,
    @InjectRepository(VerifiedClient)
    private verifiedClientsRepository: Repository<VerifiedClient>,
    @InjectRepository(VerifiedDeal)
    private verifiedDealsRepository: Repository<VerifiedDeal>,
    @InjectRepository(VerifiedClientAllowance)
    private verifiedClientAllowanceRepository: Repository<VerifiedClientAllowance>,
    @InjectRepository(VerifierAllowance)
    private verifierAllowanceRepository: Repository<VerifierAllowance>,
    @InjectRepository(GlifDataCapRequest)
    private glifDataCapRequestRepository: Repository<GlifDataCapRequest>,
    @InjectRepository(GhDataCapRequest)
    private ghDataCapRequestRepository: Repository<GhDataCapRequest>,
    @InjectRepository(GhIssue)
    private ghIssueRepository: Repository<GhIssue>,
    @InjectRepository(ApiKeyRequest, READ_DB_WITH_TIMEOUT)
    private apiKeyRequestRepository: Repository<ApiKeyRequest>,
    @InjectRepository(BotEvent)
    private botEventsRepository: Repository<BotEvent>,
    @InjectRepository(ApiKey, READ_DB_WITH_TIMEOUT)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(CronRunningState)
    private cronRunningStateRepository: Repository<CronRunningState>,

    @InjectRepository(CronRunningState, READ_DB_WITH_TIMEOUT)
    private cronRunningStateRepositoryWithTimeout: Repository<CronRunningState>,
    protected readonly config: AppConfig,
    protected lotus: LotusService,
    protected lotusBackup: LotusBackupService,

    @InjectRepository(VerifiedRegistryMessage)
    private verifiedRegistryMessagesRepository: Repository<VerifiedRegistryMessage>,
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  async health_api() {
    let isApiHealthy = true;
    const stats = {};
    console.log(this.config.values.lotusBackup.url);
    try {
      const crtHeight = (await this.lotus.client.chain.getHead()).Height;
    } catch (e) {
      isApiHealthy = false;
      stats['lotus'] = `error ${e.message}`;
    }

    try {
      await this.httpService
        .get(`https://api.datacapstats.io/api/health`)
        .toPromise();
    } catch (e) {
      isApiHealthy = false;
      stats['datacapstats'] = `error ${e.message}`;
    }

    if (!isApiHealthy) {
      throw new HttpException(stats, 503);
    }
  }

  async health() {
    let isScraperHealthy = true;
    const stats = {};
    try {
      //check queues that have messages but no egress rate
      const rabbitMqInfo = await this.httpService
        .get(
          `http://${this.config.values.rabbitmq.hostname}:15672/api/queues`,
          {
            auth: {
              username: this.config.values.rabbitmq.username,
              password: this.config.values.rabbitmq.password,
            },
          },
        )
        .toPromise();

      if (!rabbitMqInfo) {
        stats['rabbitmq_queues'] = 'error, no info available';
        isScraperHealthy = false;
      }
    } catch (e) {
      isScraperHealthy = false;
      stats['rabbitmq_queues'] = `error ${e.message}`;
    }

    //check rabbitmq management api virtual hosts
    try {
      await this.httpService
        .get(
          `http://${this.config.values.rabbitmq.hostname}:15672/api/health/checks/virtual-hosts`,
          {
            auth: {
              username: this.config.values.rabbitmq.username,
              password: this.config.values.rabbitmq.password,
            },
          },
        )
        .toPromise();
    } catch (e) {
      isScraperHealthy = false;
      stats['rabbitmq_vhost_health'] = `error ${e.message}`;
    }

    try {
      //check amazon s3 mainnet.json is available
      await this.httpService
        .head(`https://filplus-deals.s3.amazonaws.com/mainnet.json`)
        .toPromise();
    } catch (e) {
      isScraperHealthy = false;
      stats['mainnet_bucket'] = `error ${e.message}`;
    }

    try {
      const crtTimestamp = Math.floor(new Date().getTime() / 1000);
      const timedOutCronsCount = await this.cronRunningStateRepositoryWithTimeout.count(
        {
          where: [
            { lastRunHasError: true },
            // {
            //   lastRunFinishTimestamp: LessThan(crtTimestamp - 36 * 3600),
            // },
          ],
        },
      );

      if (timedOutCronsCount > 0) {
        stats['crons'] = timedOutCronsCount;

        isScraperHealthy = false;
      }
    } catch (e) {
      // isScraperHealthy = false;
      // stats['crons'] = `error ${e.message}`;
    }

    if (!isScraperHealthy) {
      throw new HttpException(stats, 503);
    }
  }

  async getApiKeyRequest(githubId: string) {
    let apiKeyRequest = await this.apiKeyRequestRepository.findOne({
      where: { githubId },
    });
    if (apiKeyRequest) return apiKeyRequest.challenge;
    apiKeyRequest = new ApiKeyRequest();
    apiKeyRequest.challenge = uuidv4();
    apiKeyRequest.githubId = githubId;
    await this.apiKeyRequestRepository.save(apiKeyRequest);
    return apiKeyRequest.challenge;
  }

  async getApiKey(gistId: string) {
    try {
      const requiredAccountAgeInDays = 7;

      const gist = (
        await this.httpService
          .get(`https://api.github.com/gists/${gistId}`)
          .toPromise()
      ).data;
      const fileNames = Object.keys(gist['files']);
      const contentUrl = gist['files'][fileNames[0]].raw_url;
      const githubId = gist['owner']['login'];

      const githubAccountInfo = (
        await this.httpService
          .get(`https://api.github.com/users/${githubId}`)
          .toPromise()
      ).data;

      const date1 = new Date(githubAccountInfo['created_at']);
      const date2 = new Date();
      const diffTime = Math.abs(date2.getTime() - date1.getTime());

      if (diffTime < requiredAccountAgeInDays * 1000 * 60 * 60 * 24) return '';

      const challenge = (await this.httpService.get(contentUrl).toPromise())
        .data;

      const apiKeyRequest = await this.apiKeyRequestRepository.findOne({
        where: { githubId, challenge },
      });
      if (!apiKeyRequest) return '';

      let apiKey = await this.apiKeyRepository.findOne({ where: { githubId } });
      if (!apiKey) {
        apiKey = new ApiKey();
        apiKey.githubId = githubId;
      }

      apiKey.key = uuidv4();

      await this.apiKeyRepository.save(apiKey);
      await this.apiKeyRequestRepository.delete(apiKeyRequest);

      return apiKey.key;
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: JSON.stringify(e),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSimpleApiKey() {
    try {
      const apiKey = new ApiKey();
      apiKey.githubId = `n/a-${uuidv4()}`;
      apiKey.key = uuidv4();

      await this.apiKeyRepository.save(apiKey);

      return apiKey.key;
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: JSON.stringify(e),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllowanceForAddress(addressId: string) {
    try {
      const verifierAllowance = await this.lotusBackup.client.state.verifierStatus(
        addressId,
      );

      const verifiedClientAllowance = await this.lotusBackup.client.state.verifiedClientStatus(
        addressId,
      );

      if (verifiedClientAllowance && !verifierAllowance) {
        return {
          type: 'verifiedClient',
          allowance: verifiedClientAllowance, //verifier.allowance,
        };
      }

      if (!verifiedClientAllowance && verifierAllowance) {
        return {
          type: 'verifier',
          allowance: verifierAllowance, //verifier.allowance,
        };
      }
      // const verifier = await this.verifiersRepository.findOne({
      //   where: [{ addressId, address: addressId }],
      // });
      // if (verifier) {
      //   const allowance = await this.lotusBackup.client.state.verifierStatus(
      //     addressId,
      //   );
      //   return {
      //     type: 'verifier',
      //     allowance: allowance, //verifier.allowance,
      //   };
      // }

      // const verifiedClient = await this.verifiedClientsRepository.findOne({
      //   where: [{ addressId, address: addressId }],
      // });
      // if (verifiedClient) {
      //   const allowance = await this.lotusBackup.client.state.verifiedClientStatus(
      //     addressId,
      //   );
      //   return {
      //     type: 'verifiedClient',
      //     allowance: allowance, //verifier.allowance,
      //   };
      // }

      return {
        type: 'error',
        message: 'Address not found',
      };
    } catch (e) {
      return {
        type: 'error',
        message: 'Address not found',
      };
    }
  }

  async findMsigMessage(msgCID: string) {
    const msg = await this.verifiedRegistryMessagesRepository.findOne({
      where: [{ msgCID }, { alternateMsgCID: msgCID }],
    });

    if (!msg) {
      return 'msg not found';
    }

    let relatedMsgs = [];
    if (msg.method == '3' && msg.toAddressType == 'multisig') {
      const decodedParameters = JSON.parse(msg.decodedParameters);
      relatedMsgs = await this.verifiedRegistryMessagesRepository.find({
        where: { proposalId: decodedParameters['ID'], to: msg.to },
      });
    }

    if (msg.method == '2' && msg.toAddressType == 'multisig') {
      relatedMsgs = await this.verifiedRegistryMessagesRepository.find({
        where: {
          decodedParameters: ILike(`%"ID":${msg.proposalId}%`),
          to: msg.to,
        },
      });
    }

    const filteredMsgs = [msg, ...relatedMsgs].map(
      (message: VerifiedRegistryMessage) => {
        return {
          msgCID: message.msgCID,
          to: message.to,
          from: message.from,
          height: message.height,
          method: message.method,
          proposalId: message.proposalId,
          decoded:
            message.method == '2'
              ? message.decodedParametersSecondary
              : message.decodedParameters,
          proposalDecodedParams: message.decodedParameters,
          proposalMethodDecodedParams: message.decodedParametersSecondary,
          receipt: message.decodedReceipt,
        };
      },
    );
    return filteredMsgs;
  }

  async storeGlifDataCapRequest(githubId: string, messageId: string) {
    try {
      const dataCapRequest = new GlifDataCapRequest();
      dataCapRequest.githubId = githubId;
      dataCapRequest.messageId = messageId;
      await this.glifDataCapRequestRepository.save(dataCapRequest);
      return dataCapRequest.id;
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: JSON.stringify(e),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async storeGhDataCapRequest(
    issueId: number,
    messageId: string,
    verifierAddressId: string,
    applicantName: string,
    applicantLocation: string,
  ) {
    try {
      const dataCapRequest = new GhDataCapRequest();
      dataCapRequest.issueId = issueId;
      dataCapRequest.messageId = messageId;
      dataCapRequest.verifierAddressId = verifierAddressId;
      dataCapRequest.applicantName = applicantName;
      dataCapRequest.applicantLocation = applicantLocation;

      await this.ghDataCapRequestRepository.save(dataCapRequest);
      return dataCapRequest.id;
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: JSON.stringify(e),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async storeBotEventRequest(storeBotEventDto: StoreBotEventDto) {
    try {
      const botEvent = new BotEvent();
      botEvent.environment = storeBotEventDto.environment;
      botEvent.repo = storeBotEventDto.repo;
      botEvent.issueNumber = storeBotEventDto.issueNumber;
      botEvent.timeStamp = storeBotEventDto.timeStamp;
      botEvent.eventType = storeBotEventDto.eventType;
      botEvent.params = storeBotEventDto.params;
      botEvent.allocationUUID = storeBotEventDto.uuid;

      if (storeBotEventDto.params && storeBotEventDto.params['eventDate']) {
        botEvent.timeStamp = storeBotEventDto.params['eventDate'];
      }
      await this.botEventsRepository.save(botEvent);
      return botEvent.id;
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: JSON.stringify(e),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getVerifiedClientsWithRetrievableData() {
    const clients = await this.entityManager.query(
      `select "addressId" from verified_client_allowance where "isDataPublic"='yes' group by "addressId";`,
    );

    return JSON.stringify({
      count: clients.length,
      data: clients.map((client) => client['addressId']),
    });
  }
}
