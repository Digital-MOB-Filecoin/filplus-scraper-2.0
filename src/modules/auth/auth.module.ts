import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { ApiKeyStrategy } from './apiKey.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../api/entities/apiKey.entity';
import { AdminApiKeyStrategy } from './adminApiKey.strategy';
import { READ_DB_WITH_TIMEOUT } from '../database-config/databaseReadOnlyWithTimeout.providers';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([ApiKey], READ_DB_WITH_TIMEOUT),
  ],
  providers: [AuthService, ApiKeyStrategy, AdminApiKeyStrategy],
})
export class AuthModule {}
