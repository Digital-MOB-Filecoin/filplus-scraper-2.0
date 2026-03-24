import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { TypeOrmDefaultConfigService } from './database.providers';
import { TypeOrmReadOnlyWithTimeoutConfigService } from './databaseReadOnlyWithTimeout.providers';
import { TypeOrmSecondaryWithTimeoutConfigService } from './tracer.providers';
import { TypeOrmScraperSecondaryConfigService } from './scraperSecondary.providers';

@Module({
  imports: [ConfigurationModule],
  providers: [
    TypeOrmDefaultConfigService,
    TypeOrmReadOnlyWithTimeoutConfigService,
    TypeOrmSecondaryWithTimeoutConfigService,
    TypeOrmScraperSecondaryConfigService,
  ],
  exports: [
    TypeOrmDefaultConfigService,
    TypeOrmReadOnlyWithTimeoutConfigService,
    TypeOrmSecondaryWithTimeoutConfigService,
    TypeOrmScraperSecondaryConfigService,
  ],
})
export class DatabaseConfigModule { }
