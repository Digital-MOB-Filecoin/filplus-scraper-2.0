import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { AppConfig } from '../../configuration/configuration.service';
import { sleep } from '../../utils/util';
import {
  getBytes,
  getIssueBodyDatacapRequestedAttributes,
  GithubCommentData,
  GithubCommentsScrapedData,
  GithubHttpCommentsResponse,
  GithubHttpIssuesResponse,
  GithubHttpResponseHeaders,
  GithubIssueData,
  GithubIssuesScrapedData,
  GithubRateLimitData,
  govTeamMemberGhIds,
} from './utils';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { GhDatacapRequestComment } from '../../../../submodules/filecoin-plus-scraper-entities/ghDatacapRequestComment.entity';
import { GhDatacapIssue } from '../../../../submodules/filecoin-plus-scraper-entities/ghDatacapIssue.entity';
import { GhDatacapAllocationRequestComment } from '../../../../submodules/filecoin-plus-scraper-entities/ghDatacapAllocationRequestComment.entity';
import { GhDatacapAllocationSignedComment } from '../../../../submodules/filecoin-plus-scraper-entities/ghDatacapAllocationSignedComment.entity';
import { VerifiedClientAllowanceSigner } from '../../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowanceSigner.entity';
import { VerifiedClientAllowance } from '../../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';
import { isNumber, isNumberString } from 'class-validator';
import { GhAllocatorInfo } from '../../../../submodules/filecoin-plus-scraper-entities/ghAllocatorInfo.entity';
import { Verifier } from '../../../../submodules/filecoin-plus-scraper-entities/verifier.entity';
import { GhClientInfo } from '../../../../submodules/filecoin-plus-scraper-entities/ghClientInfo.entity';
import { GhAllocationInfo } from '../../../../submodules/filecoin-plus-scraper-entities/ghAllocationInfo.entity';
import { GhAllocationSignerInfo } from '../../../../submodules/filecoin-plus-scraper-entities/ghAllocationSignerInfo.entity';
import { ClientContract } from 'submodules/filecoin-plus-scraper-entities/clientContract.entity';
import { LotusService } from 'src/modules/lotus/lotus.service';
import { GhAllocatorInfoV2 } from 'submodules/filecoin-plus-scraper-entities/ghAllocatorInfoV2.entity';

@Injectable()
export class GithubApiScraper {
  private readonly logger = new Logger(GithubApiScraper.name);
  protected readonly perPageQueryKey: string = 'per_page';
  protected readonly perPageDefault: number = 100;
  protected readonly pageQueryKey: string = 'page';
  protected readonly issueKey: string = '{issue}';
  protected readonly owner: string = 'filecoin-project';
  protected readonly repo: string = 'filecoin-plus-large-datasets';
  protected readonly issuesApi: string = `https://api.github.com/repos/${this.owner}/${this.repo}/issues?state=all`;
  protected readonly allocatorIssuesApi: string = `https://api.github.com/repos/filecoin-project/notary-governance/issues?q=is%3Aissue+is%3Aopen+label%3A"Round+5+-+Allocator"`;

  protected readonly commentsApi: string = `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${this.issueKey}/comments`;
  protected readonly allocatorCommentsApi: string = `https://api.github.com/repos/filecoin-project/notary-governance/issues/${this.issueKey}/comments`;

  protected issues: GithubIssueData[];
  protected dbIssues: any = {};
  private scraperInProgress = false;
  protected readonly issuesGraphQLApi: string = `https://api.github.com/graphql`;

  /* dependency injection */
  constructor(
    protected readonly httpService: HttpService,
    protected readonly config: AppConfig,
    @InjectRepository(ClientContract)
    private clientContractRepository: Repository<ClientContract>,
    @InjectRepository(GhAllocatorInfo)
    private ghAllocatorInfoRepository: Repository<GhAllocatorInfo>,
    @InjectRepository(Verifier)
    private verifierRepository: Repository<Verifier>,
    @InjectRepository(GhClientInfo)
    private ghClientInfoRepository: Repository<GhClientInfo>,
    @InjectRepository(GhAllocatorInfoV2)
    private ghAllocatorInfoV2Repository: Repository<GhAllocatorInfoV2>,
    @InjectRepository(GhAllocationInfo)
    private ghAllocationInfoRepository: Repository<GhAllocationInfo>,
    @InjectRepository(GhAllocationSignerInfo)
    private ghAllocationSignerInfoRepository: Repository<GhAllocationSignerInfo>,
    @InjectEntityManager()
    private entityManager: EntityManager,
    protected lotus: LotusService,
  ) { }

  async fetchRateLimit() {
    const response = await this.httpService
      .get(`https://api.github.com/rate_limit`, {
        auth: {
          username: this.config.values.github.user,
          password: this.config.values.github.token,
        },
      })
      .toPromise();

    return response.data;
  }

  protected async checkRateLimit(responseHeaders: GithubHttpResponseHeaders) {
    const rateLimitData = new GithubRateLimitData(responseHeaders);
    this.logger.debug(
      `Request rate limit remaining count ${rateLimitData.requestRemainingCount}`,
    );

    if (rateLimitData.requestRemainingCount === 0) {
      const limitMs =
        rateLimitData.requestResetDate.getTime() - Date.now() + 250;

      this.logger.debug(
        `Request rate limit  reached, waiting ${limitMs / 1000} seconds`,
      );

      await sleep(limitMs);
    }
  }

  protected async request(
    url: string,
    page: number,
    perPage = this.perPageDefault,
    isSearchApi = false,
  ): Promise<GithubHttpIssuesResponse | GithubHttpCommentsResponse> {
    let response: any;
    try {
      response = await this.httpService
        .get(
          `${url}${isSearchApi ? '&' : '?'}${this.pageQueryKey}=${page}&${this.perPageQueryKey
          }=${perPage}`,
          {
            auth: {
              username: this.config.values.github.user,
              password: this.config.values.github.token,
            },
          },
        )
        .toPromise();
    } catch (e) {
      if (e?.response?.status !== 403) {
        console.log('error');
        throw e;
      }
      await this.checkRateLimit(e.response);
      return this.request(url, page, perPage, isSearchApi);
    }

    await this.checkRateLimit(response);

    return response;
  }

  public async getAllocatorRegistryContents() {
    try {
      const contents = await this.httpService
        .get(
          `https://api.github.com/repos/filecoin-project/Allocator-Registry/contents/Allocators`,
          {
            auth: {
              username: this.config.values.github.user,
              password: this.config.values.github.token,
            },
          },
        )
        .toPromise();

      if (contents.data) {
        const allocatorInfoArray = [];
        const verifiersToUpdate = [];
        for (const item of contents.data) {
          try {
            const nameArr = item.name.split('.');
            console.log('nameArr', nameArr);
            if (nameArr[1] === 'json') {
              console.log('item', item.download_url);
              const getNotaryInfoResponse = await this.httpService
                .get(item.download_url)
                .toPromise();

              if (getNotaryInfoResponse && getNotaryInfoResponse.data) {
                const notaryInfo = getNotaryInfoResponse.data;
                if (!notaryInfo.address) {
                  throw new Error('notary info address is missing');
                }

                let processedJsonData = null;
                if (isNumberString(nameArr[0]))
                  processedJsonData = await this.processAllocatorJsonV1(notaryInfo, nameArr[0]);
                else
                  processedJsonData = await this.processAllocatorJsonV2(notaryInfo, nameArr[0]);

                if (processedJsonData) {
                  const { allocatorInfo, verifierInfo } = processedJsonData;
                  if (allocatorInfo) {
                    allocatorInfoArray.push(allocatorInfo);
                  }
                  if (verifierInfo) {
                    verifiersToUpdate.push(verifierInfo);
                  }
                }
              }
            }
          } catch (e) {
            if (e?.response?.status !== 403) {
              console.log('error', e);
            }
          }
        }
        await this.ghAllocatorInfoRepository.save(allocatorInfoArray);
        await this.verifierRepository.save(verifiersToUpdate);
      }
    } catch (e) {
      if (e?.response?.status !== 403) {
        console.log('error', e);
      }
    }
  }

  public async processAllocatorJsonV1(notaryInfo, applicationNumber) {
    const response = { allocatorInfo: null, verifierInfo: null }
    if (notaryInfo.application.client_contract_address) {
      const clientContract = notaryInfo.application.client_contract_address;
      let clientContractRecord = await this.clientContractRepository.findOne(
        {
          where: [
            { address: clientContract },
            { addressId: clientContract }]
        });

      if (!clientContractRecord) {
        const clientContractRecord = this.clientContractRepository.create();
        if (clientContract.indexOf('f0') === 0) {
          clientContractRecord.addressId = clientContract;
          let address = '';
          try {
            address = await this.lotus.client.state.accountKey(clientContract);
          }
          catch (e) {

          }
          clientContractRecord.address = address;
        } else {
          clientContractRecord.address = clientContract;
          let addressId = '';
          try {
            addressId = await this.lotus.client.state.lookupId(clientContract);
          }
          catch (e) {
          }
          clientContractRecord.addressId = addressId;
        }

        let addressEth: any = '';
        try {
          addressEth = await this.lotus.httpConnector.request({
            method: 'Filecoin.FilecoinAddressToEthAddress',
            params: [
              clientContractRecord.address
            ],
          });
        }
        catch (e) {
        }

        clientContractRecord.addressEth = addressEth.toLowerCase();

        await this.clientContractRepository.save(clientContractRecord);
      }
    }

    let dbRecord = await this.ghAllocatorInfoRepository.findOne({
      where: { applicationNumber: applicationNumber },
    });
    if (!dbRecord) dbRecord = this.ghAllocatorInfoRepository.create();

    dbRecord.address = notaryInfo.address;
    dbRecord.applicationNumber = notaryInfo.application_number;
    dbRecord.isVirtual = notaryInfo.application.tooling.includes('smart_contract_allocator');
    dbRecord.pathwayAddresses = notaryInfo.pathway_addresses;
    // dbRecord.addressId: string;

    dbRecord.name = notaryInfo.name;
    dbRecord.organization = notaryInfo.organization;
    dbRecord.allocationBookkeeping = notaryInfo.application.allocation_bookkeeping;
    dbRecord.clientContractAddress = notaryInfo.application.client_contract_address;

    dbRecord.fullInfo = notaryInfo;
    response.allocatorInfo = dbRecord;
    // allocatorInfoArray.push(dbRecord);

    if (dbRecord.address) {
      let addressToSearch = dbRecord.address;
      if (dbRecord.isVirtual) {
        addressToSearch = dbRecord.pathwayAddresses['msig'];
      }
      let verifierRecord = await this.verifierRepository.findOne({
        where: [
          { address: addressToSearch },
          { addressId: addressToSearch },
          { addressEth: addressToSearch.toLowerCase() },
        ],
      }); //search for both address and addressID
      if (verifierRecord) {
        verifierRecord.name = dbRecord.name;
        verifierRecord.orgName = dbRecord.organization;

        response.verifierInfo = verifierRecord;
        // verifiersToUpdate.push(verifierRecord);
      }
    }

    return response;
  }

  public async processAllocatorJsonV2(notaryInfo, applicationHash) {
    const response = { allocatorInfo: null, verifierInfo: null }
    let ghAllocatorInfoExtended = await this.ghAllocatorInfoV2Repository.findOne({ where: { applicationHash: applicationHash } });
    if (!ghAllocatorInfoExtended) {
      ghAllocatorInfoExtended = this.ghAllocatorInfoV2Repository.create({ applicationHash: applicationHash });
    }

    const applicationNumber = notaryInfo.application_number;
    ghAllocatorInfoExtended.address = notaryInfo.address || '';
    ghAllocatorInfoExtended.applicationNumber = notaryInfo.application_number || '';
    ghAllocatorInfoExtended.name = notaryInfo.name || '';
    ghAllocatorInfoExtended.organization = notaryInfo.organization || '';
    ghAllocatorInfoExtended.metapathwayType = notaryInfo.metapathway_type || '';
    ghAllocatorInfoExtended.maAddress = notaryInfo.ma_address || '';
    ghAllocatorInfoExtended.associatedOrgAddresses = notaryInfo.associated_org_addresses || '';
    ghAllocatorInfoExtended.application = notaryInfo.application || {};
    ghAllocatorInfoExtended.pathwayAddresses = notaryInfo.pathway_addresses || {};
    ghAllocatorInfoExtended.allocatorId = notaryInfo.allocator_id || '';
    ghAllocatorInfoExtended.oldAllocatorId = notaryInfo.old_allocator_id || '';
    ghAllocatorInfoExtended.auditHistory = notaryInfo.history || {};
    ghAllocatorInfoExtended.audits = notaryInfo.audits || [];

    await this.ghAllocatorInfoV2Repository.save(ghAllocatorInfoExtended);

    if (notaryInfo.application.client_contract_address) {
      const clientContract = notaryInfo.application.client_contract_address;
      let clientContractRecord = await this.clientContractRepository.findOne(
        {
          where: [
            { address: clientContract },
            { addressId: clientContract }]
        });

      if (!clientContractRecord) {
        const clientContractRecord = this.clientContractRepository.create();
        if (clientContract.indexOf('f0') === 0) {
          clientContractRecord.addressId = clientContract;
          let address = '';
          try {
            address = await this.lotus.client.state.accountKey(clientContract);
          }
          catch (e) {

          }
          clientContractRecord.address = address;
        } else {
          clientContractRecord.address = clientContract;
          let addressId = '';
          try {
            addressId = await this.lotus.client.state.lookupId(clientContract);
          }
          catch (e) {
          }
          clientContractRecord.addressId = addressId;
        }

        let addressEth: any = '';
        try {
          addressEth = await this.lotus.httpConnector.request({
            method: 'Filecoin.FilecoinAddressToEthAddress',
            params: [
              clientContractRecord.address
            ],
          });
        }
        catch (e) {
        }

        clientContractRecord.addressEth = addressEth.toLowerCase();

        await this.clientContractRepository.save(clientContractRecord);
      }
    }

    let dbRecord = await this.ghAllocatorInfoRepository.findOne({
      where: { applicationNumber: applicationNumber },
    });
    if (!dbRecord) dbRecord = this.ghAllocatorInfoRepository.create();

    dbRecord.address = notaryInfo.address;
    dbRecord.applicationNumber = notaryInfo.application_number;
    dbRecord.isVirtual = notaryInfo.metapathway_type ? notaryInfo.metapathway_type.includes('MA') : false;
    dbRecord.pathwayAddresses = notaryInfo.pathway_addresses;
    // dbRecord.addressId: string;

    dbRecord.name = notaryInfo.name;
    dbRecord.organization = notaryInfo.organization;
    dbRecord.allocationBookkeeping = notaryInfo.application.allocation_bookkeeping;
    dbRecord.clientContractAddress = notaryInfo.application.client_contract_address;

    dbRecord.fullInfo = notaryInfo;
    response.allocatorInfo = dbRecord;
    // allocatorInfoArray.push(dbRecord);

    if (dbRecord.address) {
      let addressToSearch = dbRecord.address;
      if (dbRecord.isVirtual) {
        addressToSearch = dbRecord.pathwayAddresses['msig'];
      }
      let verifierRecord = await this.verifierRepository.findOne({
        where: [
          { address: addressToSearch },
          { addressId: addressToSearch },
        ],
      }); //search for both address and addressID
      if (verifierRecord) {
        verifierRecord.name = dbRecord.name;
        verifierRecord.orgName = dbRecord.organization;

        response.verifierInfo = verifierRecord;
        // verifiersToUpdate.push(verifierRecord);
      }
    }

    return response;
  }

  public async getAllocationsFromContents() {
    let allocatorsRecords = await this.ghAllocatorInfoRepository.find({});
    for (const item of allocatorsRecords) {
      const allocatorRecord: any = item;
      const allocationBookkeepingPieces = allocatorRecord.fullInfo.application
        .allocation_bookkeeping
        ? allocatorRecord.fullInfo.application.allocation_bookkeeping.split('/')
        : [];

      if (allocationBookkeepingPieces.length === 5) {
        const org = allocationBookkeepingPieces[3];
        const repo = allocationBookkeepingPieces[4];

        try {
          const contents = await this.httpService
            .get(
              `https://api.github.com/repos/${org}/${repo}/contents/applications`,
              {
                auth: {
                  username: this.config.values.github.user,
                  password: this.config.values.github.token,
                },
              },
            )
            .toPromise();

          if (contents.data && contents.data.length > 0) {
            //
            const fetchApplicationsPromises = [];
            for (const item of contents.data) {
              const nameArr = item.name.split('.');
              if (nameArr[1] === 'json') {
                fetchApplicationsPromises.push(
                  this.httpService.get(item.download_url).toPromise(),
                );
              }
            }

            const applications = [];
            const applicationsResponses = await Promise.all(
              fetchApplicationsPromises,
            );

            let allocationsBatch = [];
            let allocationSignersBatch = [];
            const batchSize = 300;

            for (const application of applicationsResponses) {
              if (application.data) {
                const applicationData = application.data;

                applications.push({
                  id: applicationData['ID'],
                  version: applicationData['Version'],
                  url: `https://raw.githubusercontent.com/${org}/${repo}/main/applications/${applicationData['ID']}.json`,
                  client: applicationData['Client'],
                  project: applicationData['Project'],
                  datacap: applicationData['Datacap'],
                  lifecycle: applicationData['Lifecycle'],
                });

                for (const allocation of applicationData[
                  'Allocation Requests'
                ]) {
                  allocationsBatch.push({
                    id: allocation['ID'],
                    clientId: applicationData['ID'],
                    type: allocation['Request Type'],
                    createdAt: allocation['Created At'],
                    updatedAt: allocation['Updated At'],
                    active: allocation['Active'],
                    amount: allocation['Allocation Amount'],
                  });

                  for (const signer of allocation['Signers']) {
                    allocationSignersBatch.push({
                      allocationId: allocation['ID'],
                      ghUsername: signer['Github Username'],
                      signingAddress: signer['Signing Address'],
                      createdAt: signer['Created At'],
                      msgCid: signer['Message CID'],
                    });
                  }
                }

                if (allocationsBatch.length >= batchSize) {
                  await this.processGhAllocationsBatch(allocationsBatch);
                  allocationsBatch = [];
                }

                if (allocationSignersBatch.length >= batchSize) {
                  await this.processGhAllocationSignersBatch(
                    allocationSignersBatch,
                  );
                  allocationSignersBatch = [];
                }
              }
            }

            if (allocationsBatch.length > 0) {
              await this.processGhAllocationsBatch(allocationsBatch);
            }

            if (allocationSignersBatch.length > 0) {
              await this.processGhAllocationSignersBatch(
                allocationSignersBatch,
              );
            }

            //can be batched at some point
            if (applications.length > 0) {
              const allocationRecords = await this.ghClientInfoRepository
                .createQueryBuilder()
                .select('id')
                .where(`id IN ('${applications.map((a) => a.id).join(`','`)}')`)
                .getRawMany();

              const existingAllocationIds = allocationRecords.map((a) => a.id);
              await this.ghClientInfoRepository.insert(
                applications
                  .filter(
                    (a: any) => existingAllocationIds.indexOf(a.id) === -1,
                  )
                  .map((a: any) =>
                    this.ghClientInfoRepository.create({
                      id: a.id,
                      version: a.version,
                      url: a.url,
                      client: a.client,
                      project: a.project,
                      datacap: a.datacap,
                      lifecycle: a.lifecycle,
                    }),
                  ),
              );

              const entityManager = this.entityManager;
              const updateValues = `${applications
                .filter((a: any) => existingAllocationIds.indexOf(a.id) !== -1)
                .map(
                  (data) =>
                    `('${data.id}', '${data.version}', '${data.url
                    }', '${JSON.stringify(data.client).replace(
                      /'/g,
                      "''",
                    )}'::jsonb, '${JSON.stringify(data.project).replace(
                      /'/g,
                      "''",
                    )}'::jsonb, '${JSON.stringify(data.datacap).replace(
                      /'/g,
                      "''",
                    )}'::jsonb, '${JSON.stringify(data.lifecycle).replace(
                      /'/g,
                      "''",
                    )}'::jsonb)`,
                )
                .join(',')}`;
              if (updateValues) {
                await entityManager.query(
                  `update gh_client_info as dac
                     set version = c.version, url = c.url, client = c.client, project = c.project, datacap=c.datacap, lifecycle=c.lifecycle from (values ${updateValues}) as c (id, version, url, client, project, datacap, lifecycle)
                     where dac.id = c."id";`,
                );
              }
            }
          }
        } catch (e) {
          console.log('error', e);
          console.log(
            `https://api.github.com/repos/${org}/${repo}/contents/applications`,
          );
        }
      }
    }
  }

  private async processGhAllocationsBatch(batch: any) {
    const batchRecords = await this.ghAllocationInfoRepository
      .createQueryBuilder()
      .select('id')
      .where(`id IN ('${batch.map((a) => a.id).join(`','`)}')`)
      .getRawMany();

    const existingBatchIds = batchRecords.map((a) => a.id);
    await this.ghAllocationInfoRepository.insert(
      batch
        .filter((a: any) => existingBatchIds.indexOf(a.id) === -1)
        .map((a: any) =>
          this.ghAllocationInfoRepository.create({
            id: a.id,
            clientId: a.clientId,
            type: a.type,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            active: a.active,
            amount: a.amount,
          }),
        ),
    );

    const entityManager = this.entityManager;
    const updateValues = `${batch
      .filter((a: any) => existingBatchIds.indexOf(a.id) !== -1)
      .map((data) => `('${data.id}', '${data.updatedAt}', '${data.active}')`)
      .join(',')}`;

    if (updateValues) {
      await entityManager.query(
        `update gh_allocation_info as dac
                     set "updatedAt" = c."updatedAt", "active" = c."active" from (values ${updateValues}) as c (id, "updatedAt", "active")
                     where dac.id = c."id";`,
      );
    }
  }

  private async processGhAllocationSignersBatch(batch: any) {
    const batchRecords = await this.ghAllocationSignerInfoRepository
      .createQueryBuilder()
      .select('"msgCid"')
      .where(`"msgCid" IN ('${batch.map((a) => a.msgCid).join(`','`)}')`)
      .getRawMany();

    const existingBatchIds = batchRecords.map((a) => a.msgCid);
    await this.ghAllocationSignerInfoRepository.insert(
      batch
        .filter((a: any) => existingBatchIds.indexOf(a.msgCid) === -1)
        .map((a: any) =>
          this.ghAllocationSignerInfoRepository.create({
            allocationId: a.allocationId,
            ghUsername: a.ghUsername,
            signingAddress: a.signingAddress,
            createdAt: a.createdAt,
            msgCid: a.msgCid,
          }),
        ),
    );
  }
}
