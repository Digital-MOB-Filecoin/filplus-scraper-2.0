import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { Channel, Message } from 'amqplib';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { VerifiedClient } from '../../../../submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import { Verifier } from '../../../../submodules/filecoin-plus-scraper-entities/verifier.entity';
import { VerifiedClientAllowance } from '../../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';
import { VerifierAllowance } from '../../../../submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import extractDataFromGithubIssue from '../../utils/extractDataFromGithubIssue';
import { VerifiedClientAllowanceSigner } from '../../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowanceSigner.entity';
import { ClientUUID } from '../../../../submodules/filecoin-plus-scraper-entities/clientUUID.entity';
import { v4 as uuidv4 } from 'uuid';
import { EventLogEth } from 'submodules/filecoin-plus-scraper-entities/eventLogEth.entity';
import { LotusArchiveService } from '../../lotus-archive/lotus.service';


@Injectable()
export class GetAllowanceAuditTrailConsumer implements IConsumer {
  public queue = 'getAllowanceAuditTrail';

  constructor(
    private httpService: HttpService,
    @InjectRepository(VerifiedClientAllowance)
    private verifiedClientAllowancesRepository: Repository<VerifiedClientAllowance>,
    @InjectRepository(VerifierAllowance)
    private verifierAllowancesRepository: Repository<VerifierAllowance>,
    @InjectRepository(Verifier)
    private verifierRepository: Repository<Verifier>,
    @InjectRepository(VerifiedClient)
    private verifiedClientRepository: Repository<VerifiedClient>,
    @InjectRepository(VerifiedClientAllowanceSigner)
    private verifiedClientAllowanceSignerRepository: Repository<VerifiedClientAllowanceSigner>,
    @InjectRepository(ClientUUID)
    private clientUUIDRepository: Repository<ClientUUID>,
    @InjectRepository(EventLogEth)
    private eventLogEthRepository: Repository<EventLogEth>,

    protected readonly config: AppConfig,
    protected lotus: LotusArchiveService,
    @Inject('ASYNC_RABBITMQ_CONNECTION')
    protected readonly rabbitMQService: RabbitMQService,
  ) { }

  private shouldSearchByProposalMsgCID(allowance: VerifiedClientAllowance) {
    return allowance.retries === 0;
  }

  public async exec(msg: string, channel: Channel, brokerMsg: Message) {
    try {
      const message = JSON.parse(msg);
      const allowanceId = message.allowanceId;
      const type = message.type;

      if (type == 'verifiedClient') {
        const allowance = await this.verifiedClientAllowancesRepository.findOne(
          {
            where: {
              id: allowanceId,
            },
          },
        );
        allowance.retries = allowance.retries - 1;

        let searchByMsgCID = allowance.msgCID;

        if (searchByMsgCID.indexOf('-') >= 0 && !this.shouldSearchByProposalMsgCID(allowance)) {
          const parts = searchByMsgCID.split('-');

          if (parts.length == 3) {
            const eventEth = await this.eventLogEthRepository.find({ where: { blockNumber: parts[0], transactionIndex: Number(parts[1]), logIndex: Number(parts[2]) } })
            if (eventEth.length == 1) {
              const messageCID = await this.lotus.httpConnector.request({
                method: 'Filecoin.EthGetMessageCidByTransactionHash',
                params: [eventEth[0].transactionHash],
              });

              if (messageCID) {
                searchByMsgCID = messageCID['/'];
              } else {
                allowance.error = 'no messageCID found for this event log';
              }
            } else {
              allowance.error = 'invalid number of events found for this msgCID';
            }
          }
        }

        if (this.shouldSearchByProposalMsgCID(allowance)) {
          const verifiedClientAllowanceSigner =
            await this.verifiedClientAllowanceSignerRepository.findOne({
              where: {
                allowanceId,
                method: 2,
              },
            });

          // if no signer exists, there is no ldn for this allowance
          if (verifiedClientAllowanceSigner) {
            allowance.searchedByProposal = true;
            searchByMsgCID = verifiedClientAllowanceSigner.msgCID;
          }
        }
        await this.verifiedClientAllowancesRepository.save(allowance);

        const findIssue = (
          await this.httpService
            .get(`https://api.github.com/search/issues?q=${searchByMsgCID}`, {
              auth: {
                username: this.config.values.github.user,
                password: this.config.values.github.token,
              },
            })
            .toPromise()
        )['data'];

        if (findIssue['total_count'] > 1) {
          allowance.error = 'found multiple issues for this cid';
        }

        if (findIssue['total_count'] == 1) {
          allowance.auditTrail = findIssue['items'][0]['html_url'];
          allowance.issueCreateTimestamp =
            new Date(findIssue['items'][0]['created_at']).getTime() / 1000;

          const issueCreator = findIssue['items'][0]['user']['login'];
          const issueCreatorId = findIssue['items'][0]['user']['id'];

          let clientUUID = await this.clientUUIDRepository.findOne({
            where: { ghId: issueCreatorId },
          });

          if (!clientUUID) {
            clientUUID = this.clientUUIDRepository.create({
              uuid: uuidv4(),
              ghLogin: issueCreator,
              ghId: issueCreatorId,
            });
            await this.clientUUIDRepository.save(clientUUID);
          }

          allowance.issueCreator = issueCreatorId;

          allowance.retries = 0;

          const { name, orgName, industry, region, website } =
            await extractDataFromGithubIssue(
              allowance.auditTrail,
              this.httpService,
              this.config,
            );
          await this.verifiedClientRepository.update(
            {
              addressId: allowance.addressId,
              verifierAddressId: allowance.verifierAddressId,
            },
            { name, orgName, industry, region, website },
          );
        }

        await this.verifiedClientAllowancesRepository.save(allowance);
      }

      if (type == 'verifier') {
        const allowance = await this.verifierAllowancesRepository.findOne({
          where: { id: allowanceId },
        });

        allowance.retries = allowance.retries - 1;
        await this.verifierAllowancesRepository.save(allowance);

        const findIssue = (
          await this.httpService
            .get(`https://api.github.com/search/issues?q=${allowance.msgCID}`, {
              auth: {
                username: this.config.values.github.user,
                password: this.config.values.github.token,
              },
            })
            .toPromise()
        )['data'];

        if (findIssue['total_count'] > 1) {
          allowance.error = 'found multiple issues for this cid';
        }

        if (findIssue['total_count'] == 1) {
          allowance.auditTrail = findIssue['items'][0]['html_url'];
          allowance.issueCreateTimestamp =
            new Date(findIssue['items'][0]['created_at']).getTime() / 1000;
          allowance.retries = 0;
          // const { name, orgName } = await extractDataFromGithubIssue(
          //   allowance.auditTrail,
          //   this.httpService,
          //   this.config,
          // );
          // await this.verifierRepository.update(
          //   {
          //     addressId: allowance.addressId,
          //   },
          //   { name, orgName },
          // );
        }

        await this.verifierAllowancesRepository.save(allowance);
      }
      channel.ack(brokerMsg);
    } catch (e) {
      console.log(e);
      channel.ack(brokerMsg);
      //this.rabbitMQService.retry('scraper', this.queue, msg).catch(() => {});
    }
  }
}
