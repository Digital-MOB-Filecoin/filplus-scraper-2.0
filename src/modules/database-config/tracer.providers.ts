import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../configuration/configuration.service';
import { VerifierAllowance } from '../scraper/tracerEntities/verifierAllowance.entity';
import { VerifiedClientAllowance } from '../scraper/tracerEntities/verifiedClientAllowance.entity';
import { Deal } from '../scraper/tracerEntities/deal.entity';
import { Allocation } from '../scraper/tracerEntities/allocation.entity';

// TODO: Add db entities here
const entities = [VerifierAllowance, VerifiedClientAllowance, Deal, Allocation];

@Injectable()
export class TypeOrmSecondaryWithTimeoutConfigService
    implements TypeOrmOptionsFactory {
    constructor(protected readonly config: AppConfig) { }

    createTypeOrmOptions(): TypeOrmModuleOptions {
        return {
            type: 'postgres',
            autoLoadEntities: false,
            logging: ['error', 'warn'],
            entities,
            ...this.config.values.tracerDatabase,
        };
    }
}

export const TRACER_DB = 'tracerDB';
