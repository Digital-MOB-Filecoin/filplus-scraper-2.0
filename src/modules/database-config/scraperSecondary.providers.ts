import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../configuration/configuration.service';
import { VerifierAllowance } from 'submodules/filecoin-plus-scraper-entities/verifierAllowance.entity';
import { GlobalValues } from 'submodules/filecoin-plus-scraper-entities/globalValues.entity';

// TODO: Add db entities here
const entities = [VerifierAllowance, GlobalValues];

@Injectable()
export class TypeOrmScraperSecondaryConfigService
    implements TypeOrmOptionsFactory {
    constructor(protected readonly config: AppConfig) { }

    createTypeOrmOptions(): TypeOrmModuleOptions {
        return {
            type: 'postgres',
            autoLoadEntities: false,
            logging: ['error', 'warn'],
            entities,
            ...this.config.values.scraperSecondaryDatabase,
        };
    }
}

export const SCRAPER_SECONDARY_DB = 'scraperSecondaryDB';
