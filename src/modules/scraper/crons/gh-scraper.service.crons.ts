import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AppConfig } from '../../configuration/configuration.service';
import { ScraperService } from '../scraper.service';
import { GithubApiScraper } from '../github/GithubApiScraper';
import { CronUtilsService, EnhancedCron } from './cronUtils.service';

@Injectable()
export class GhScraperServiceCrons {
  constructor(
    private cronUtilsService: CronUtilsService,

    protected readonly config: AppConfig,
  ) { }

  //cron to get gh extra data
  @EnhancedCron(
    CronExpression.EVERY_10_MINUTES,
    CronExpression.EVERY_10_MINUTES,
  )
  async getAllowanceAuditTrail() {
    await this.cronUtilsService.executeCron(
      'getAllowanceAuditTrail',
      'scraperService',
      [],
    );
  }

  //cron to get allocator info from registry
  @EnhancedCron(
    CronExpression.EVERY_DAY_AT_5AM,
    CronExpression.EVERY_DAY_AT_5AM,
  )
  async getAllocatorRegistryContents() {
    await this.cronUtilsService.executeCron(
      'getAllocatorRegistryContents',
      'githubApiScraper',
      [],
    );
  }

  //cron to get allocations from gh repos
  @EnhancedCron(CronExpression.EVERY_HOUR, CronExpression.EVERY_HOUR)
  async getAllocationsFromContents() {
    await this.cronUtilsService.executeCron(
      'getAllocationsFromContents',
      'githubApiScraper',
      [],
    );
  }
}
