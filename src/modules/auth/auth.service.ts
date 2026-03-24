import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../api/entities/apiKey.entity';
import { READ_DB_WITH_TIMEOUT } from '../database-config/databaseReadOnlyWithTimeout.providers';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(ApiKey, READ_DB_WITH_TIMEOUT)
    private apiKeyRepository: Repository<ApiKey>,
  ) {}

  async validateApiKey(apiKey: string, checkForAdmin: boolean = false) {
    const apiKeyDB = await this.apiKeyRepository.findOne({
      where: { key: apiKey, isAdmin: !!checkForAdmin },
    });

    if (apiKeyDB) return true;
    return false;
  }
}
