import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { LotusBackupService } from './lotus-backup.service';

@Module({
  imports: [ConfigurationModule],
  providers: [LotusBackupService],
  exports: [LotusBackupService],
})
export class LotusBackupModule {}
