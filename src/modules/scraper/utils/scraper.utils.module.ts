import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressCache } from 'submodules/filecoin-plus-scraper-entities/addressCache.entity';
import { LotusArchiveModule } from '../../lotus-archive/lotus.module';
import { ScraperUtilsService } from './scraper.utils.service';

@Module({
  imports: [
    LotusArchiveModule,

    TypeOrmModule.forFeature([
      AddressCache,

    ]),
  ],
  providers: [
    ScraperUtilsService,
  ],
  exports: [
    ScraperUtilsService
  ],
})
export class ScraperUtilsModule { }
