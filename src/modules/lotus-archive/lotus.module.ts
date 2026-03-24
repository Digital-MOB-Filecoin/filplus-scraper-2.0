import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { LotusArchiveService } from './lotus.service';

@Module({
  imports: [ConfigurationModule],
  providers: [LotusArchiveService],
  exports: [LotusArchiveService],
})
export class LotusArchiveModule {}
