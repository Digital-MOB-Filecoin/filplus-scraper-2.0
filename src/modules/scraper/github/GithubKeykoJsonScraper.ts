import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { KeykoNotary } from './utils';

@Injectable()
export class GithubKeykoJsonScraper {
  private readonly logger = new Logger(GithubKeykoJsonScraper.name);
  protected readonly jsonUrl: string = `https://raw.githubusercontent.com/keyko-io/filecoin-content/main/json/prod/verifiers-registry.json`;

  /* dependency injection */
  constructor(protected readonly httpService: HttpService) {}

  public async getJson(): Promise<KeykoNotary[]> {
    const response = await this.httpService.get(this.jsonUrl).toPromise();

    return response.data.notaries;
  }

  public async getNotaries(): Promise<KeykoNotary[]> {
    let keykoNotaries: KeykoNotary[] = [];
    try {
      keykoNotaries = await this.getJson();
    } catch (e) {
      this.logger.error('Error in processing keyko notaries JSON');
      console.error(e);
    }

    return keykoNotaries;
  }
}
