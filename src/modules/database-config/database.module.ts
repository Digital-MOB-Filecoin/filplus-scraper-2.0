import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { TypeOrmDefaultConfigService } from './database.providers';
import { TypeOrmReadOnlyWithTimeoutConfigService } from './databaseReadOnlyWithTimeout.providers';
import { TypeOrmSecondaryWithTimeoutConfigService } from './tracer.providers';

@Module({
  imports: [ConfigurationModule],
  providers: [
    TypeOrmDefaultConfigService,
    TypeOrmReadOnlyWithTimeoutConfigService,
    TypeOrmSecondaryWithTimeoutConfigService,
  ],
  exports: [
    TypeOrmDefaultConfigService,
    TypeOrmReadOnlyWithTimeoutConfigService,
    TypeOrmSecondaryWithTimeoutConfigService,
  ],
})
export class DatabaseConfigModule { }
