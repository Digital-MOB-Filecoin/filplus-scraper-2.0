import { Injectable } from '@nestjs/common';
import {
  HttpJsonRpcConnector,
  LotusClient,
  LotusWalletProvider,
  WsJsonRpcConnector,
} from 'filecoin.js';
import { AppConfig } from '../configuration/configuration.service';

@Injectable()
export class LotusBackupService {
  public client: LotusClient;
  public httpConnector: HttpJsonRpcConnector;
  public walletProvider: LotusWalletProvider;

  constructor(protected readonly config: AppConfig) {
    const httpConnector = new HttpJsonRpcConnector({
      url: this.config.values.lotusBackup.url,
      token: this.config.values.lotusBackup.token,
    });

    this.httpConnector = httpConnector;
    this.client = new LotusClient(httpConnector);
    this.walletProvider = new LotusWalletProvider(this.client);
  }
}
