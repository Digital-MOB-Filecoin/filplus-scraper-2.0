import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { OneOffController } from './one-off.controller';
import { AppService } from './app.service';
import configuration from './configuration';
import { DatabaseConfigModule } from './modules/database-config/database.module';
import { TypeOrmDefaultConfigService } from './modules/database-config/database.providers';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigurationModule } from './modules/configuration/configuration.module';

import { ScraperModule } from './modules/scraper/scraper.module';
import { ApiModule } from './modules/api/api.module';
import { RabbitMQModule } from './modules/rabbitmq/rabbitmq.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  READ_DB_WITH_TIMEOUT,
  TypeOrmReadOnlyWithTimeoutConfigService,
} from './modules/database-config/databaseReadOnlyWithTimeout.providers';
import {
  TRACER_DB,
  TypeOrmSecondaryWithTimeoutConfigService,
} from './modules/database-config/tracer.providers';
import {
  SCRAPER_SECONDARY_DB,
  TypeOrmScraperSecondaryConfigService,
} from './modules/database-config/scraperSecondary.providers';

@Module({
  imports: [
    ThrottlerModule.forRoot(),
    ConfigModule.forRoot({
      ignoreEnvFile: false,
      ignoreEnvVars: false,
      isGlobal: true,
      expandVariables: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [DatabaseConfigModule],
      useExisting: TypeOrmDefaultConfigService,
    }),

    TypeOrmModule.forRootAsync({
      name: READ_DB_WITH_TIMEOUT,
      imports: [DatabaseConfigModule],
      useExisting: TypeOrmReadOnlyWithTimeoutConfigService,
    }),

    TypeOrmModule.forRootAsync({
      name: TRACER_DB,
      imports: [DatabaseConfigModule],
      useExisting: TypeOrmSecondaryWithTimeoutConfigService,
    }),

    TypeOrmModule.forRootAsync({
      name: SCRAPER_SECONDARY_DB,
      imports: [DatabaseConfigModule],
      useExisting: TypeOrmScraperSecondaryConfigService,
    }),

    RabbitMQModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ConfigurationModule,
    ScraperModule,
    ApiModule,
    AuthModule,
  ],
  controllers: [AppController, OneOffController],
  providers: [AppService],
})
export class AppModule { }
