import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { AppConfig } from '../../configuration/configuration.service';
import { LotusService } from '../../lotus/lotus.service';
import { ScraperService } from '../../scraper/scraper.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import {
  DealState,
  VerifiedDeal,
} from '../../../../submodules/filecoin-plus-scraper-entities/verifiedDeal.entity';
import { VerifiedClient } from '../../../../submodules/filecoin-plus-scraper-entities/verifiedClient.entity';

@Injectable()
export class UpsertDealData implements IConsumer {
  public queue = 'upsertDealData';

  constructor(
    @InjectRepository(VerifiedDeal)
    private verifiedDealsRepository: Repository<VerifiedDeal>,
    @InjectRepository(VerifiedClient)
    private verifiedClientsRepository: Repository<VerifiedClient>,
    protected readonly config: AppConfig,
    // protected lotus: LotusService,
    protected scraperService: ScraperService,
    @Inject('ASYNC_RABBITMQ_CONNECTION')
    protected readonly rabbitMQService: RabbitMQService,
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) { }

  public async exec(content: any, channel: Channel, brokerMsg: Message) {
    const numberOfUint32ValuesPerDeal = 7;
    const numberOfAddressValuesPerDeal = 2;
    const numberOfBigNumberValuesPerDeal = 1;
    const numberOfCidValuesPerDeal = 1;

    let msgContent = brokerMsg.content;
    const noOfItems =
      (msgContent.length - Uint32Array.BYTES_PER_ELEMENT) /
      (Uint32Array.BYTES_PER_ELEMENT * numberOfUint32ValuesPerDeal +
        Uint8Array.BYTES_PER_ELEMENT * 41 * numberOfAddressValuesPerDeal +
        Uint8Array.BYTES_PER_ELEMENT * 14 * numberOfBigNumberValuesPerDeal +
        Uint8Array.BYTES_PER_ELEMENT * 64 * numberOfCidValuesPerDeal);

    let uint32Offset = 0;
    let addressOffset =
      Uint32Array.BYTES_PER_ELEMENT +
      Uint32Array.BYTES_PER_ELEMENT * numberOfUint32ValuesPerDeal * noOfItems -
      1;
    let bigNumberOffset =
      Uint32Array.BYTES_PER_ELEMENT +
      Uint32Array.BYTES_PER_ELEMENT * numberOfUint32ValuesPerDeal * noOfItems +
      Uint8Array.BYTES_PER_ELEMENT *
      41 *
      numberOfAddressValuesPerDeal *
      noOfItems -
      1;
    let cidOffset =
      Uint32Array.BYTES_PER_ELEMENT +
      Uint32Array.BYTES_PER_ELEMENT * numberOfUint32ValuesPerDeal * noOfItems +
      Uint8Array.BYTES_PER_ELEMENT *
      41 *
      numberOfAddressValuesPerDeal *
      noOfItems +
      Uint8Array.BYTES_PER_ELEMENT *
      14 *
      numberOfBigNumberValuesPerDeal *
      noOfItems -
      1;

    let dealSectorStartEpoch;
    let dealId;
    let dealClient;
    let dealPieceCID;
    let dealProvider;
    let dealPieceSize;
    let dealPricePerEpoch;
    let dealStartEpoch;
    let dealEndEpoch;
    let lastBlockHeight;
    let dealSectorIdLow;
    let dealSectorIdHigh;

    try {
      const dealIds = [];
      const dealsDictionary = {};

      for (let i = 0; i < noOfItems; i++) {
        dealSectorStartEpoch = msgContent.readUInt32LE((uint32Offset += 4));
        dealId = msgContent.readUInt32LE((uint32Offset += 4));
        dealPricePerEpoch = msgContent.readUInt32LE((uint32Offset += 4));
        dealStartEpoch = msgContent.readUInt32LE((uint32Offset += 4));
        dealEndEpoch = msgContent.readUInt32LE((uint32Offset += 4));
        dealSectorIdLow = msgContent.readUInt32LE((uint32Offset += 4));
        dealSectorIdHigh = msgContent.readUInt32LE((uint32Offset += 4));

        dealClient = '';
        for (let i = 0; i < 41; i++) {
          dealClient += String.fromCharCode(
            msgContent.readUInt8((addressOffset += 1)),
          );
        }
        dealClient = dealClient.replace(/^0+/, '');

        dealProvider = '';
        for (let i = 0; i < 41; i++) {
          dealProvider += String.fromCharCode(
            msgContent.readUInt8((addressOffset += 1)),
          );
        }
        dealProvider = dealProvider.replace(/^0+/, '');

        dealPieceCID = '';
        for (let i = 0; i < 64; i++) {
          dealPieceCID += String.fromCharCode(
            msgContent.readUInt8((cidOffset += 1)),
          );
        }
        dealPieceCID = dealPieceCID.replace(/^0+/, '');

        dealPieceSize = '';
        for (let i = 0; i < 14; i++) {
          dealPieceSize += String.fromCharCode(
            msgContent.readUInt8((bigNumberOffset += 1)),
          );
        }
        dealPieceSize = dealPieceSize.replace(/^0+/, '');

        const dealSectorId =
          dealSectorIdHigh == 0
            ? dealSectorIdLow
            : BigInt(dealSectorIdLow) +
            (BigInt(dealSectorIdHigh) << BigInt(32));

        if (dealId !== 0) {
          dealsDictionary[dealId] = {
            dealSectorStartEpoch,
            dealClient,
            dealPieceCID,
            dealProvider,
            dealPieceSize,
            dealPricePerEpoch,
            dealStartEpoch,
            dealEndEpoch,
            dealSectorId,
          };
          dealIds.push(dealId);
        }
      }

      lastBlockHeight = msgContent.readUInt32LE(0);
      msgContent = null; // make gc free memory faster for buffer content

      const entityManager = this.entityManager;

      const verifiedDealDb = await entityManager.query(
        `SELECT "dealId", "claimId" FROM verified_deals_new WHERE "dealId" = ANY($1)`,
        [dealIds]
      );

      const dealClaimDictionary = {};
      for (const item of verifiedDealDb) {
        dealClaimDictionary[item.dealId] = item.claimId;
      }

      const filteredDealIds = [];
      const dealIdsToUpdate = [];
      //go through deal ids and if there is a deal with claim != 0 skip, otherwise add to filteredDealIds for claim fetching
      //also build an array with deals to update
      for (const dealId of dealIds) {
        if (!dealClaimDictionary[dealId] || dealClaimDictionary[dealId] === 0) {
          filteredDealIds.push(dealId);
        }

        if (dealClaimDictionary[dealId] === 0) {
          dealIdsToUpdate.push(dealId);
        }
      }

      const insertArray = [];
      const updateArray = [];

      Object.keys(dealsDictionary).forEach((dId) => {
        if (!filteredDealIds.includes(Number(dId))) {
          return;
        }

        let dealState = DealState.ACTIVE;

        if (
          dealsDictionary[dId].dealSectorStartEpoch === -1 ||
          dealsDictionary[dId].dealSectorStartEpoch > lastBlockHeight
        ) {
          dealState = DealState.UNKNOWN;
        }

        const auxDealDb = new VerifiedDeal();
        auxDealDb.verifiedClientAddressId = dealsDictionary[dId].dealClient;
        auxDealDb.dealId = Number(dId);
        auxDealDb.pieceCID = dealsDictionary[dId].dealPieceCID;
        auxDealDb.provider = dealsDictionary[dId].dealProvider;
        auxDealDb.dealSize = dealsDictionary[dId].dealPieceSize;
        auxDealDb.storagePricePerEpoch =
          dealsDictionary[dId].dealPricePerEpoch;

        auxDealDb.createdAtHeight = dealsDictionary[dId].dealStartEpoch; // not accurate
        auxDealDb.startEpoch = dealsDictionary[dId].dealStartEpoch;
        auxDealDb.endEpoch = dealsDictionary[dId].dealEndEpoch;
        auxDealDb.sectorId = dealsDictionary[dId].dealSectorId;
        auxDealDb.addedAtHeight = lastBlockHeight;

        auxDealDb.state = dealState;

        if (dealIdsToUpdate.includes(Number(dId))) {
          updateArray.push(auxDealDb);
        } else if (!dealClaimDictionary[dId] && dealClaimDictionary[dId] !== 0) {
          insertArray.push(auxDealDb);
        }

      });

      const updateClaimsArray = [];
      let dcAllocationClaimsDb = [];
      if (filteredDealIds.length) {
        //Logger.log(`Fetching claims`, 'UpsertDealData');
        dcAllocationClaimsDb = await entityManager.query(`
        select id, "claimId", "providerId", "pieceCid", "sectorId", "dealId" from unified_verified_deal
          where exists(select provider_id, piece_cid, sector_id
                       from (values ${filteredDealIds
            .map(
              (id) =>
                `('${dealsDictionary[id].dealProvider.substring(
                  2,
                )}', '${dealsDictionary[id].dealPieceCID}', '${dealsDictionary[id].dealSectorId
                }')`,
            )
            .join(',')}
                            ) as c(provider_id, piece_cid, sector_id)
                       where provider_id = "providerId" and "pieceCid"=piece_cid and "sectorId"=sector_id);
      `);
      }

      const dcAllocationClaimsDbDictionary = dcAllocationClaimsDb.reduce(
        (acc, claim) => {
          if (!claim.claimId) {
            return acc;
          }

          acc[`f0${claim.providerId}-${claim.pieceCid}-${claim.sectorId}`] =
            claim;
          return acc;
        },
        {},
      );

      for (const item of insertArray) {
        item.claimId = 0;
        const claimKey = `f0${item.provider.substring(2)}-${item.pieceCID}-${item.sectorId}`;
        if (dcAllocationClaimsDbDictionary[claimKey]) {
          item.claimId = dcAllocationClaimsDbDictionary[claimKey].claimId;

          if (dcAllocationClaimsDbDictionary[claimKey].dealId === null ||
            dcAllocationClaimsDbDictionary[claimKey].dealId === 0) {
            // need to update dealId in claim
            updateClaimsArray.push({
              id: dcAllocationClaimsDbDictionary[claimKey].id,
              dealId: item.dealId,
            });
          }
        }
      }

      const filteredUpdateArray = [];
      for (const item of updateArray) {
        const claimKey = `f0${item.provider.substring(2)}-${item.pieceCID}-${item.sectorId}`;
        if (dcAllocationClaimsDbDictionary[claimKey]) {
          item.claimId = dcAllocationClaimsDbDictionary[claimKey].claimId;
          filteredUpdateArray.push(item);
        }
      }

      console.log(`Inserting ${insertArray.length} new deals and updating ${filteredUpdateArray.length} deals and ${updateClaimsArray.length} claims`);

      if (insertArray.length) {
        await this.entityManager.query(
          `INSERT INTO verified_deals_new 
          ("verifiedClientAddressId", 
           "dealId",
           "pieceCID",
           "provider",
           "dealSize",
           "storagePricePerEpoch",
           "createdAtHeight",
           "startEpoch",
           "endEpoch",
           "sectorId",
           "addedAtHeight",
           "state",
           "claimId"
           ) values ${insertArray.map(e => `('${e.verifiedClientAddressId}','${e.dealId}', '${e.pieceCID}', '${e.provider}', '${e.dealSize}', '${e.storagePricePerEpoch}', '${e.createdAtHeight}', '${e.startEpoch}', '${e.endEpoch}', '${e.sectorId}', '${e.addedAtHeight}', '${e.state}', '${e.claimId}')`).join(',')} ON CONFLICT do nothing; `,
        );
      }

      if (updateClaimsArray.length) {
        await entityManager.query(
          `update unified_verified_deal as dc
               set "dealId" = c."dealId" from (values ${updateClaimsArray
            .map((data) => `(${data.id}, ${data.dealId})`)
            .join(',')}) as c (id, "dealId")
               where c.id = dc.id;`,
        );
      }

      if (filteredUpdateArray.length) {
        await entityManager.query(
          `update verified_deals_new as dc
               set "claimId" = c."claimId" from (values ${filteredUpdateArray
            .map((data) => `(${data.dealId}, ${data.claimId})`)
            .join(',')}) as c ("dealId", "claimId")
               where c."dealId" = dc."dealId";`,
        );
      }
      channel.ack(brokerMsg);
    } catch (e) {
      console.log(e);
      channel.ack(brokerMsg);
      this.rabbitMQService
        .retry('scraper', this.queue, msgContent)
        .catch(() => { });
    }
  }
}
