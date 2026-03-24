import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AppConfig } from '../../configuration/configuration.service';
import { LotusService } from '../../lotus/lotus.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { EventLog } from '../../../../submodules/filecoin-plus-scraper-entities/eventLog.entity';
import { DcAllocationClaim } from '../../../../submodules/filecoin-plus-scraper-entities/dcAllocationClaim.entity';
import { decodeEventParam } from '../../utils/util';
import { decode } from '@glif/filecoin-address';
import { bytesToBig } from '../../utils/hamt-old';
import { LotusArchiveService } from '../../lotus-archive/lotus.service';
import { DcVerifierUpdate } from '../../../../submodules/filecoin-plus-scraper-entities/dcVerifierUpdate';
import { sha256 } from 'js-sha256';
import { FailedDecodeLog } from '../../../../submodules/filecoin-plus-scraper-entities/failedDecodeLog.entity';
import { ProcessedSectorEventsData } from '../../../../submodules/filecoin-plus-scraper-entities/processedSectorEventsData.entity';

@Injectable()
export class ProcessSectorEventConsumer implements IConsumer {
  public queue = 'processSectorEvent';

  constructor(
    @InjectRepository(EventLog)
    private eventLogRepository: Repository<EventLog>,
    @InjectRepository(DcAllocationClaim)
    private dcAllocationClaimRepository: Repository<DcAllocationClaim>,
    @InjectRepository(DcVerifierUpdate)
    private dcVerifierUpdateRepository: Repository<DcVerifierUpdate>,
    @InjectRepository(FailedDecodeLog)
    private failedDecodeLogRepository: Repository<FailedDecodeLog>,
    @InjectRepository(ProcessedSectorEventsData)
    private processedSectorEventsDataRepository: Repository<ProcessedSectorEventsData>,
    protected readonly config: AppConfig,
    protected lotus: LotusService,
    protected lotusArchive: LotusArchiveService,

    @Inject('ASYNC_RABBITMQ_CONNECTION')
    protected readonly rabbitMQService: RabbitMQService,
  ) {}

  public async exec(msg: string, channel: Channel, brokerMsg: Message) {
    try {
      Logger.log('Processing sector event');
      const events = JSON.parse(msg);

      // iterate over events, build a dictionary of events by id and an array of ids
      const sectorEventIds = [];
      const sectorEventDict = {};
      for (const event of events) {
        if (event.provider && event.sector && event[`piece-cid`]) {
          const id = `('${event.provider}','${event.sector}','${
            event[`piece-cid`]
          }')`;
          sectorEventIds.push(id);
          sectorEventDict[id] = event;
        }
      }

      const existingSectorEvents = await this.processedSectorEventsDataRepository.query(
        `select * from processed_sector_events_data where (provider, sector, "pieceCid") in (${sectorEventIds.join(
          ',',
        )})`,
      );

      // iterate over existing sectors, build a dictionary of sectors by id
      const existingAllocationClaimIds = [];
      for (const claim of existingSectorEvents) {
        const id = `('${claim.provider}','${claim.sector}','${claim.pieceCid}')`;
        existingAllocationClaimIds.push(id);
      }

      const sectorsToInsert = [];

      for (const item of Object.entries(sectorEventDict)) {
        const event = item[1];
        const id = item[0];
        if (!existingAllocationClaimIds.includes(id)) {
          sectorsToInsert.push(
            this.processedSectorEventsDataRepository.create({
              provider: event['provider'],
              pieceCid: event['piece-cid'],
              pieceSize: Number(event['piece-size']),
              sector: event['sector'],
              height: event['height'],
            }),
          );
        }
      }

      Logger.log(`
        insert: ${sectorsToInsert.length},
        duplicatedAllocations: ${existingSectorEvents.length},`);

      if (sectorsToInsert.length) {
        await this.processedSectorEventsDataRepository.insert(sectorsToInsert);
      }

      channel.ack(brokerMsg);
      // Logger.log('Processed verified registry event');
    } catch (e) {
      Logger.log(`failed to process event batch ${JSON.stringify(e)}`);
      channel.ack(brokerMsg);
    }
  }
}
