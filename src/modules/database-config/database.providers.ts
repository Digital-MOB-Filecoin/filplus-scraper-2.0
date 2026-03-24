import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../configuration/configuration.service';
import { GlobalValues } from '../../../submodules/filecoin-plus-scraper-entities/globalValues.entity';
import { VerifiedClient } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import { VerifiedDeal } from '../../../submodules/filecoin-plus-scraper-entities/verifiedDeal.entity';
import { Verifier } from '../../../submodules/filecoin-plus-scraper-entities/verifier.entity';
import { OpLog } from '../../../submodules/filecoin-plus-scraper-entities/opLog.entity';
import { VerifRegState } from '../../../submodules/filecoin-plus-scraper-entities/verifRegState.entity';
import { VerifiedClientAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';
import { MinerInfo } from '../../../submodules/filecoin-plus-scraper-entities/minerInfo.entity';
import { GlifDataCapRequest } from '../../../submodules/filecoin-plus-scraper-entities/glifDataCapRequest.entity';
import { GhDataCapRequest } from '../../../submodules/filecoin-plus-scraper-entities/ghDataCapRequest.entity';
import { GhIssue } from '../../../submodules/filecoin-plus-scraper-entities/ghIssue.entity';
import { ApiKeyRequest } from '../api/entities/apiKeyRequest.entity';
import { ApiKey } from '../api/entities/apiKey.entity';
import { VerifierAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { VerifiedRegistryMessage } from '../../../submodules/filecoin-plus-scraper-entities/verifiedRegistryMessage';
import { BotEvent } from '../../../submodules/filecoin-plus-scraper-entities/botEvent';
import { StorageMarketMessage } from '../../../submodules/filecoin-plus-scraper-entities/storageMarketMessage';
import { AddressCache } from '../../../submodules/filecoin-plus-scraper-entities/addressCache.entity';
import { VerifiedClientAllowanceSigner } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowanceSigner.entity';
import { GhDatacapRequestComment } from '../../../submodules/filecoin-plus-scraper-entities/ghDatacapRequestComment.entity';
import { GhDatacapIssue } from '../../../submodules/filecoin-plus-scraper-entities/ghDatacapIssue.entity';
import { GhDatacapAllocationRequestComment } from '../../../submodules/filecoin-plus-scraper-entities/ghDatacapAllocationRequestComment.entity';
import { GhDatacapAllocationSignedComment } from '../../../submodules/filecoin-plus-scraper-entities/ghDatacapAllocationSignedComment.entity';
import { CronRunningState } from '../../../submodules/filecoin-plus-scraper-entities/cronRunningState.entity';
import { RetriableBlock } from '../../../submodules/filecoin-plus-scraper-entities/retriableBlock.entity';
import { ClientUUID } from '../../../submodules/filecoin-plus-scraper-entities/clientUUID.entity';
import { FilfoxMessage } from '../../../submodules/filecoin-plus-scraper-entities/filfoxMessage';
import { MultisigAlert } from '../../../submodules/filecoin-plus-scraper-entities/multisigAlert';
import { ApiKeyUsage } from '../api/entities/apiKeyUsage.entity';
import { EventLog } from '../../../submodules/filecoin-plus-scraper-entities/eventLog.entity';
import { DcAllocationClaim } from '../../../submodules/filecoin-plus-scraper-entities/dcAllocationClaim.entity';
import { GhAllocatorInfo } from '../../../submodules/filecoin-plus-scraper-entities/ghAllocatorInfo.entity';
import { FailedDecodeLog } from '../../../submodules/filecoin-plus-scraper-entities/failedDecodeLog.entity';
import { DcVerifierUpdate } from '../../../submodules/filecoin-plus-scraper-entities/dcVerifierUpdate';
import { BackfillRanges } from '../api/entities/backfillRanges.entity';
import { GhClientInfo } from '../../../submodules/filecoin-plus-scraper-entities/ghClientInfo.entity';
import { GhAllocationInfo } from '../../../submodules/filecoin-plus-scraper-entities/ghAllocationInfo.entity';
import { GhAllocationSignerInfo } from '../../../submodules/filecoin-plus-scraper-entities/ghAllocationSignerInfo.entity';
import { DcAllocatedToClientsGroupedByVerifiersWow } from '../../../submodules/filecoin-plus-scraper-entities/dcAllocatedToClientsGroupedByVerifiersWow.entity';
import { DcUsedByClientsWow } from '../../../submodules/filecoin-plus-scraper-entities/dcUsedByClientsWow.entity';
import { DcAllocatedToClientsTotalByWeek } from '../../../submodules/filecoin-plus-scraper-entities/dcAllocatedToClientsTotalByWeek.entity';
import { ProcessedSectorEventsData } from '../../../submodules/filecoin-plus-scraper-entities/processedSectorEventsData.entity';
import { UnifiedVerifiedDeal } from '../../../submodules/filecoin-plus-scraper-entities/unifiedVerifiedDeal.entity';
import { TipsetKeyByHeight } from '../api/entities/tipsetKeyByHeight';
import { UnifiedVerifiedDealV2 } from '../../../submodules/filecoin-plus-scraper-entities/unifiedVerifiedDealV2.entity';
import { DcUpdateEventsWithDcSpend } from 'submodules/filecoin-plus-scraper-entities/dcUpdateEventsWithDcSpend.entity';
import { DcUpdateMessages } from 'submodules/filecoin-plus-scraper-entities/dcUpdateMessages';
import { DcAllocationMessages } from 'submodules/filecoin-plus-scraper-entities/dcAllocationMessages';
import { EventLogEth } from 'submodules/filecoin-plus-scraper-entities/eventLogEth.entity';
import { MetaAllocator } from 'submodules/filecoin-plus-scraper-entities/metaAllocator.entity';
import { ClientContract } from 'submodules/filecoin-plus-scraper-entities/clientContract.entity';
import { MessageToDcAllocation } from 'submodules/filecoin-plus-scraper-entities/messageToDcAllocation';
import { TempDcAllocationMessages } from 'submodules/filecoin-plus-scraper-entities/tempDcAllocationMessages';
import { GhAllocatorInfoV2 } from 'submodules/filecoin-plus-scraper-entities/ghAllocatorInfoV2.entity';

// TODO: Add db entities here
const entities = [
  GlobalValues,
  Verifier,
  VerifiedClient,
  VerifiedDeal,
  OpLog,
  VerifRegState,
  VerifiedClientAllowance,
  MinerInfo,
  GlifDataCapRequest,
  GhDataCapRequest,
  GhIssue,
  ApiKeyRequest,
  ApiKey,
  ApiKeyUsage,
  VerifierAllowance,
  VerifiedRegistryMessage,
  BotEvent,
  StorageMarketMessage,
  AddressCache,
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
  DcUpdateEventsWithDcSpend,
  DcUpdateMessages,
  DcAllocationMessages,
  EventLogEth,
  MetaAllocator,
  ClientContract,
  MessageToDcAllocation,
  TempDcAllocationMessages,
  GhAllocatorInfoV2
];

@Injectable()
export class TypeOrmDefaultConfigService implements TypeOrmOptionsFactory {
  constructor(protected readonly config: AppConfig) { }

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      synchronize: true,
      autoLoadEntities: false,
      logging: ['error', 'warn'],
      entities,
      ...this.config.values.database,
    };
  }
}
