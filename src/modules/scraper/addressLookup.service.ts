import { Injectable } from '@nestjs/common';

import { AppConfig } from '../configuration/configuration.service';
import { LotusService } from '../lotus/lotus.service';
import { AddressCache } from '../../../submodules/filecoin-plus-scraper-entities/addressCache.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AddressLookupService {
  constructor(
    protected lotus: LotusService,
    @InjectRepository(AddressCache)
    private addressCacheRepository: Repository<AddressCache>,
    protected readonly config: AppConfig,
  ) {}

  async populateAddressTuple(input: string) {
    let cacheItem = await this.addressCacheRepository.findOne({
      where: [{ address: input }, { addressId: input }],
    });

    if (cacheItem) {
      return {
        address: cacheItem.address,
        addressId: cacheItem.addressId,
        isMultisig: cacheItem.isMultisig,
      };
    }

    let address = '';
    let addressId = '';
    let isMultisig = false;

    if (input.indexOf('f0') == 0) {
      addressId = input;
    } else {
      address = input;
    }

    try {
      if (addressId != '') {
        address = await this.lotus.client.state.accountKey(addressId);
      }
    } catch (e) {
      isMultisig = true;
    }

    try {
      if (address != '') {
        addressId = await this.lotus.client.state.lookupId(address);
      }
    } catch (e) {
      isMultisig = true;
    }

    cacheItem = this.addressCacheRepository.create({
      address,
      addressId,
      isMultisig,
    });
    await this.addressCacheRepository.save(cacheItem);

    return {
      address,
      addressId,
      isMultisig,
    };
  }
}
