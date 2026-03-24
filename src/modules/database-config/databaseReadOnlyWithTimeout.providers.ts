import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../configuration/configuration.service';
import { GlobalValues } from '../../../submodules/filecoin-plus-scraper-entities/globalValues.entity';
import { CronRunningState } from '../../../submodules/filecoin-plus-scraper-entities/cronRunningState.entity';
import { ApiKeyRequest } from '../api/entities/apiKeyRequest.entity';
import { ApiKey } from '../api/entities/apiKey.entity';

// TODO: Add db entities here
const entities = [GlobalValues, CronRunningState, ApiKey, ApiKeyRequest];

@Injectable()
export class TypeOrmReadOnlyWithTimeoutConfigService
  implements TypeOrmOptionsFactory {
  constructor(protected readonly config: AppConfig) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      autoLoadEntities: false,
      logging: ['error', 'warn'],
      entities,
      extra: {
        poolSize: 20,
        connectionTimeoutMillis: 1000,
        query_timeout: 1000,
        statement_timeout: 1000,
      },
      ...this.config.values.database,
    };
  }
}

export const READ_DB_WITH_TIMEOUT = 'readDBWithTimeout';
