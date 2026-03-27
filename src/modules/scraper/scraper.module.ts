import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalValues } from '../../../submodules/filecoin-plus-scraper-entities/globalValues.entity';
import { ConfigurationModule } from '../configuration/configuration.module';
import { LotusModule } from '../lotus/lotus.module';
import { ScraperServiceCrons } from './crons/scraper.service.crons';
import { ScraperService } from './scraper.service';
import { Verifier } from '../../../submodules/filecoin-plus-scraper-entities/verifier.entity';
import { VerifiedClient } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import { VerifiedDeal } from '../../../submodules/filecoin-plus-scraper-entities/verifiedDeal.entity';
import { OpLog } from '../../../submodules/filecoin-plus-scraper-entities/opLog.entity';
import { ScraperServiceSubscribers } from './scraper.service.subscribers';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { VerifRegState } from '../../../submodules/filecoin-plus-scraper-entities/verifRegState.entity';
import { UpsertDealData } from './consumers/upsertDealData';
import { VerifiedClientAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';
import { MinerInfo } from '../../../submodules/filecoin-plus-scraper-entities/minerInfo.entity';
import { GhIssue } from '../../../submodules/filecoin-plus-scraper-entities/ghIssue.entity';
import { VerifierAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { VerifierAllowance as TracerVerifierAllowance } from './tracerEntities/verifierAllowance.entity';
import { VerifiedClientAllowance as TracerVerifiedClientAllowance } from './tracerEntities/verifiedClientAllowance.entity';
import { Deal as TracerDeal } from './tracerEntities/deal.entity';
import { Allocation as TracerAllocation } from './tracerEntities/allocation.entity';

import { VerifiedRegistryMessage } from '../../../submodules/filecoin-plus-scraper-entities/verifiedRegistryMessage';
import { UpdateMultisigAddressConsumer } from './consumers/updateMultisigAddress';
import { GetAllowanceAuditTrailConsumer } from './consumers/getAllowanceAuditTrail';
import { LotusBackupModule } from '../lotus-backup/lotus-backup.module';
import { StorageMarketMessage } from '../../../submodules/filecoin-plus-scraper-entities/storageMarketMessage';
import { AddressLookupService } from './addressLookup.service';
import { AddressCache } from '../../../submodules/filecoin-plus-scraper-entities/addressCache.entity';
import { BotEvent } from '../../../submodules/filecoin-plus-scraper-entities/botEvent';
import { VerifiedClientAllowanceSigner } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowanceSigner.entity';
import { GhScraperServiceCrons } from './crons/gh-scraper.service.crons';
import { GithubApiScraper } from './github/GithubApiScraper';
import { GhDatacapRequestComment } from '../../../submodules/filecoin-plus-scraper-entities/ghDatacapRequestComment.entity';
import { GhDatacapIssue } from '../../../submodules/filecoin-plus-scraper-entities/ghDatacapIssue.entity';
import { GhDatacapAllocationRequestComment } from '../../../submodules/filecoin-plus-scraper-entities/ghDatacapAllocationRequestComment.entity';
import { GhDatacapAllocationSignedComment } from '../../../submodules/filecoin-plus-scraper-entities/ghDatacapAllocationSignedComment.entity';
import { CronUtilsService } from './crons/cronUtils.service';
import { CronRunningState } from '../../../submodules/filecoin-plus-scraper-entities/cronRunningState.entity';
import { RetriableBlock } from '../../../submodules/filecoin-plus-scraper-entities/retriableBlock.entity';
import { GithubKeykoJsonScraper } from './github/GithubKeykoJsonScraper';
import { OneOffService } from './oneOffService/oneOff.service';
import { ClientUUID } from '../../../submodules/filecoin-plus-scraper-entities/clientUUID.entity';
import { FilfoxMessage } from '../../../submodules/filecoin-plus-scraper-entities/filfoxMessage';
import { MultisigAlert } from '../../../submodules/filecoin-plus-scraper-entities/multisigAlert';
import { EventLog } from '../../../submodules/filecoin-plus-scraper-entities/eventLog.entity';
import { DcAllocationClaim } from '../../../submodules/filecoin-plus-scraper-entities/dcAllocationClaim.entity';
import { GhAllocatorInfo } from '../../../submodules/filecoin-plus-scraper-entities/ghAllocatorInfo.entity';
import { FailedDecodeLog } from '../../../submodules/filecoin-plus-scraper-entities/failedDecodeLog.entity';
import { LotusArchiveModule } from '../lotus-archive/lotus.module';
import { DcVerifierUpdate } from '../../../submodules/filecoin-plus-scraper-entities/dcVerifierUpdate';
import { BackfillRanges } from '../api/entities/backfillRanges.entity';
import { GhClientInfo } from '../../../submodules/filecoin-plus-scraper-entities/ghClientInfo.entity';
import { GhAllocationInfo } from '../../../submodules/filecoin-plus-scraper-entities/ghAllocationInfo.entity';
import { GhAllocationSignerInfo } from '../../../submodules/filecoin-plus-scraper-entities/ghAllocationSignerInfo.entity';
import { DcAllocatedToClientsTotalByWeek } from '../../../submodules/filecoin-plus-scraper-entities/dcAllocatedToClientsTotalByWeek.entity';
import { DcUsedByClientsWow } from '../../../submodules/filecoin-plus-scraper-entities/dcUsedByClientsWow.entity';
import { DcAllocatedToClientsGroupedByVerifiersWow } from '../../../submodules/filecoin-plus-scraper-entities/dcAllocatedToClientsGroupedByVerifiersWow.entity';
import { ProcessedSectorEventsData } from '../../../submodules/filecoin-plus-scraper-entities/processedSectorEventsData.entity';
import { ProcessSectorEventConsumer } from './consumers/processSectorEvent';
import { FetchClaimsForProviderConsumer } from './consumers/fetchClaimsForProvider';
import { ProcessClaimsFileConsumer } from './consumers/processClaimsFile';
import { ProcessClaimsBatchConsumer } from './consumers/processClaimsBatch';
import { FetchTracerVerifierAllowancesConsumer } from './consumers/fetchTracerVerifierAllowances';
import { FetchTracerVerifiedClientAllowancesConsumer } from './consumers/fetchTracerVerifiedClientAllowances';
import { FetchTracerDealsConsumer } from './consumers/fetchTracerDeals';


import { READ_DB_WITH_TIMEOUT } from '../database-config/databaseReadOnlyWithTimeout.providers';
import { UnifiedVerifiedDeal } from '../../../submodules/filecoin-plus-scraper-entities/unifiedVerifiedDeal.entity';

import { TipsetKeyByHeight } from '../api/entities/tipsetKeyByHeight';
import { UnifiedVerifiedDealV2 } from '../../../submodules/filecoin-plus-scraper-entities/unifiedVerifiedDealV2.entity';

import { DcUpdateMessages } from 'submodules/filecoin-plus-scraper-entities/dcUpdateMessages';
import { DcUpdateEventsWithDcSpend } from 'submodules/filecoin-plus-scraper-entities/dcUpdateEventsWithDcSpend.entity';
import { DcAllocationMessages } from 'submodules/filecoin-plus-scraper-entities/dcAllocationMessages';
import { ScraperUtilsModule } from './utils/scraper.utils.module';
import { EventLogEth } from 'submodules/filecoin-plus-scraper-entities/eventLogEth.entity';
import { MetaAllocator } from 'submodules/filecoin-plus-scraper-entities/metaAllocator.entity';
import { ClientContract } from 'submodules/filecoin-plus-scraper-entities/clientContract.entity';
import { MessageToDcAllocation } from 'submodules/filecoin-plus-scraper-entities/messageToDcAllocation';
import { TempDcAllocationMessages } from 'submodules/filecoin-plus-scraper-entities/tempDcAllocationMessages';
import { GhAllocatorInfoV2 } from 'submodules/filecoin-plus-scraper-entities/ghAllocatorInfoV2.entity';
import { TRACER_DB } from '../database-config/tracer.providers';

@Module({
  imports: [
    HttpModule,
    ConfigurationModule,
    RabbitMQModule,
    LotusModule,
    LotusBackupModule,
    LotusArchiveModule,
    ScraperUtilsModule,

    TypeOrmModule.forFeature([
      GlobalValues,
      Verifier,
      VerifiedClient,
      VerifiedDeal,
      OpLog,
      VerifRegState,
      VerifiedClientAllowance,
      MinerInfo,
      GhIssue,
      VerifierAllowance,
      VerifiedRegistryMessage,
      VerifiedClientAllowance,
      StorageMarketMessage,
      AddressCache,
      BotEvent,
      VerifiedClientAllowanceSigner,
      GhDatacapRequestComment,
      GhDatacapIssue,
      GhDatacapAllocationRequestComment,
      GhDatacapAllocationSignedComment,
      CronRunningState,
      RetriableBlock,
      ClientUUID,
      FilfoxMessage,
      MultisigAlert,
      EventLog,
      DcAllocationClaim,
      GhAllocatorInfo,
      FailedDecodeLog,
      DcVerifierUpdate,
      BackfillRanges,
      GhClientInfo,
      GhAllocationInfo,
      GhAllocationSignerInfo,
      DcAllocatedToClientsGroupedByVerifiersWow,
      DcUsedByClientsWow,
      DcAllocatedToClientsTotalByWeek,
      ProcessedSectorEventsData,
      UnifiedVerifiedDeal,
      TipsetKeyByHeight,
      UnifiedVerifiedDealV2,
      DcUpdateMessages,
      DcUpdateEventsWithDcSpend,
      DcAllocationMessages,
      EventLogEth,
      MetaAllocator,
      ClientContract,
      MessageToDcAllocation,
      TempDcAllocationMessages,
      GhAllocatorInfo,
      GhAllocatorInfoV2
    ]),

    TypeOrmModule.forFeature(
      [GlobalValues, CronRunningState],
      READ_DB_WITH_TIMEOUT,
    ),

    TypeOrmModule.forFeature(
      [TracerVerifierAllowance, TracerVerifiedClientAllowance, TracerDeal, TracerAllocation],
      TRACER_DB,
    ),
  ],
  providers: [
    ScraperService,
    OneOffService,
    ScraperServiceSubscribers,
    ScraperServiceCrons,
    GhScraperServiceCrons,

    GetAllowanceAuditTrailConsumer,
    UpdateMultisigAddressConsumer,
    UpsertDealData,
    AddressLookupService,
    ProcessSectorEventConsumer,
    FetchClaimsForProviderConsumer,
    ProcessClaimsFileConsumer,
    ProcessClaimsBatchConsumer,
    FetchTracerVerifierAllowancesConsumer,
    FetchTracerVerifiedClientAllowancesConsumer,
    FetchTracerDealsConsumer,
    GithubApiScraper,
    GithubKeykoJsonScraper,
    CronUtilsService,
  ],
  exports: [
    ScraperService,
    OneOffService,
    ScraperServiceSubscribers,
    ScraperServiceCrons,
    GhScraperServiceCrons,
    AddressLookupService,
    GithubApiScraper,
  ],
})
export class ScraperModule { }
