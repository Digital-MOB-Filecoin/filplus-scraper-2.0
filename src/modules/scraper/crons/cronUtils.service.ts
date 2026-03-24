import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppConfig } from '../../configuration/configuration.service';
import { CronRunningState } from '../../../../submodules/filecoin-plus-scraper-entities/cronRunningState.entity';

import { applyDecorators } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScraperService } from '../scraper.service';
import { GithubApiScraper } from '../github/GithubApiScraper';

export function EnhancedCron(
  devCronExpression: CronExpression | string,
  prodCronExpression: CronExpression | string,
) {
  if (process.env.DISABLE_CRONS != 'true')
    return applyDecorators(
      Cron(
        process.env.NODE_ENV == 'production'
          ? prodCronExpression
          : devCronExpression,
      ),
    );
  else return () => { };
}

@Injectable()
export class CronUtilsService {
  constructor(
    protected readonly config: AppConfig,
    private scraperService: ScraperService,
    private githubApiScraper: GithubApiScraper,

    @InjectRepository(CronRunningState)
    private cronRunningStateRepository: Repository<CronRunningState>,
  ) { }

  async onModuleInit() {
    console.log(`Initialization...`);
    await this.resetAllFlags();
    console.log(`All cron flags reset`);
  }

  async checkCronIsRunning(name: string) {
    let cronInfo = await this.cronRunningStateRepository.findOne({
      where: { key: name },
    });
    if (!cronInfo) return false;
    return cronInfo.isRunning;
  }

  async markCronAsRunning(name: string) {
    let cronInfo = await this.cronRunningStateRepository.findOne({
      where: { key: name },
    });
    if (!cronInfo)
      cronInfo = this.cronRunningStateRepository.create({ key: name });
    cronInfo.isRunning = true;
    cronInfo.crtRunStartTimestamp = Math.round(new Date().getTime() / 1000);
    await this.cronRunningStateRepository.save(cronInfo);
  }

  async markCronAsNotRunning(name: string, error: string) {
    let cronInfo = await this.cronRunningStateRepository.findOne({
      where: { key: name },
    });
    if (!cronInfo)
      cronInfo = this.cronRunningStateRepository.create({ key: name });
    cronInfo.isRunning = false;
    console.log(error);
    cronInfo.lastRunError = error;
    cronInfo.lastRunHasError = error !== '';

    cronInfo.lastRunStartTimestamp = cronInfo.crtRunStartTimestamp;
    cronInfo.crtRunStartTimestamp = 0;
    cronInfo.lastRunFinishTimestamp = Math.round(new Date().getTime() / 1000);

    await this.cronRunningStateRepository.save(cronInfo);
  }

  async executeCron(name: string, serviceName: string, params: any) {
    const isRunning = await this.checkCronIsRunning(name);
    if (!isRunning) {
      try {
        await this.markCronAsRunning(name);
        await this[serviceName][name](...params);
        await this.markCronAsNotRunning(name, '');
      } catch (e) {
        await this.markCronAsNotRunning(name, e.message);
      }
    }
  }

  async resetAllFlags() {
    await this.cronRunningStateRepository.update({}, { isRunning: false });
  }
}
