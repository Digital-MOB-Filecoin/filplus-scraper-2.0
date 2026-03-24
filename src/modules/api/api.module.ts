import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalValues } from '../../../submodules/filecoin-plus-scraper-entities/globalValues.entity';
import { ConfigurationModule } from '../configuration/configuration.module';
import { LotusModule } from '../lotus/lotus.module';
import { ApiService } from './api.service';
import { Verifier } from '../../../submodules/filecoin-plus-scraper-entities/verifier.entity';
import { VerifiedClient } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClient.entity';
import { VerifiedDeal } from '../../../submodules/filecoin-plus-scraper-entities/verifiedDeal.entity';
import { OpLog } from '../../../submodules/filecoin-plus-scraper-entities/opLog.entity';
import { ApiController } from './api.controller';
import { VerifiedClientAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifiedClientAllowance.entity';
import { GlifDataCapRequest } from '../../../submodules/filecoin-plus-scraper-entities/glifDataCapRequest.entity';
import { GhDataCapRequest } from '../../../submodules/filecoin-plus-scraper-entities/ghDataCapRequest.entity';
import { GhIssue } from '../../../submodules/filecoin-plus-scraper-entities/ghIssue.entity';
import { PublicApiController } from './public.api.controller';
import { ApiKey } from './entities/apiKey.entity';
import { ApiKeyRequest } from './entities/apiKeyRequest.entity';
import { VerifierAllowance } from '../../../submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { BotEvent } from '../../../submodules/filecoin-plus-scraper-entities/botEvent';
import { LotusBackupModule } from '../lotus-backup/lotus-backup.module';
import { ApiMetricsMiddleware } from './middlewares/ApiMetricsMiddleware';
import {
  makeCounterProvider,
  makeHistogramProvider,
  PrometheusModule,
} from '@willsoto/nestjs-prometheus';
import { VerifiedRegistryMessage } from '../../../submodules/filecoin-plus-scraper-entities/verifiedRegistryMessage';
import { ApiUsageTrackingMiddleware } from './middlewares/ApiUsageTrackingMiddleware';
import { ApiKeyUsage } from './entities/apiKeyUsage.entity';
import { CronRunningState } from '../../../submodules/filecoin-plus-scraper-entities/cronRunningState.entity';
import { READ_DB_WITH_TIMEOUT } from '../database-config/databaseReadOnlyWithTimeout.providers';

@Module({
  imports: [
    HttpModule,
    ConfigurationModule,
    LotusModule,
    LotusBackupModule,
    TypeOrmModule.forFeature([
      GlobalValues,
      Verifier,
      VerifiedClient,
      VerifiedDeal,
      OpLog,
      VerifiedClientAllowance,
      GlifDataCapRequest,
      GhDataCapRequest,
      GhIssue,

      VerifierAllowance,
      BotEvent,
      VerifiedRegistryMessage,
      ApiKeyUsage,
      CronRunningState,
    ]),

    TypeOrmModule.forFeature(
      [GlobalValues, CronRunningState, ApiKey, ApiKeyRequest],
      READ_DB_WITH_TIMEOUT,
    ),
    PrometheusModule.register({
      defaultLabels: {
        app: 'filplus',
      },
    }),
  ],
  providers: [
    ApiService,
    makeHistogramProvider({
      name: 'http_request_duration_milliseconds',
      help: 'Http request duration in milliseconds',
      labelNames: ['method', 'route', 'code'],
    }),
    makeHistogramProvider({
      name: 'http_request_size_bytes',
      help: 'Http request size in bytes',
      labelNames: ['method', 'route', 'code'],
    }),
    makeHistogramProvider({
      name: 'http_response_size_bytes',
      help: 'Http response size in bytes',
      labelNames: ['method', 'route', 'code'],
    }),
    makeCounterProvider({
      name: 'http_all_request_total',
      help: 'Count of all http requests (includes erroneous requests)',
      labelNames: ['method', 'route', 'code'],
    }),
    makeCounterProvider({
      name: 'http_all_success_total',
      help: 'Count of all successful http requests',
      labelNames: ['method', 'route', 'code'],
    }),
    makeCounterProvider({
      name: 'http_all_errors_total',
      help: 'Count of all erroneous http requests',
      labelNames: ['method', 'route', 'code'],
    }),
    makeCounterProvider({
      name: 'http_all_client_error_total',
      help: 'Count of all http requests with client errors',
      labelNames: ['method', 'route', 'code'],
    }),
    makeCounterProvider({
      name: 'http_all_server_error_total',
      help: 'Count of all http requests with server errors',
      labelNames: ['method', 'route', 'code'],
    }),
    makeCounterProvider({
      name: 'http_request_total',
      help:
        'Count of all http requests (includes erroneous requests) per request',
      labelNames: ['method', 'route', 'code'],
    }),
  ],
  exports: [ApiService],
  controllers: [ApiController, PublicApiController],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiMetricsMiddleware).forRoutes('api');
    consumer.apply(ApiMetricsMiddleware).forRoutes('public/api');
    consumer.apply(ApiUsageTrackingMiddleware).forRoutes('public/api');
  }
}
