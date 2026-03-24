import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {

  Repository,
} from 'typeorm';

import { LotusArchiveService } from '../../lotus-archive/lotus.service';

import { AddressCache } from 'submodules/filecoin-plus-scraper-entities/addressCache.entity';


@Injectable()
export class ScraperUtilsService {

  constructor(

    protected lotusArchive: LotusArchiveService,

    @InjectRepository(AddressCache)
    private addressCacheRepository: Repository<AddressCache>,

  ) { }


  async normalizeAddress(input: string) {
    if (input.substring(0, 2) === 'f0') {
      return input;
    } else if (input.substring(0, 1) !== 'f') {
      return `f0${input}`;
    } else {
      const addressDb = await this.addressCacheRepository.findOne({ where: { address: input } });
      if (addressDb) {
        return addressDb.addressId;
      } else {
        const addressId = await this.lotusArchive.client.state.lookupId(input);
        await this.addressCacheRepository.save({ address: input, addressId, isMultisig: false });
        return addressId;
      }
    }
  }
}
