import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AdminApiKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'header_apikey_admin',
) {
  constructor(private authService: AuthService) {
    super({ header: 'X-API-KEY', prefix: '' }, true, async (apiKey, done) => {
      return await this.validate(apiKey, done);
    });
  }

  async validate(apiKey: string, done: (error: Error, data) => {}) {
    const checkKey = await this.authService.validateApiKey(apiKey, true);
    if (checkKey) {
      done(null, true);
    }
    done(new UnauthorizedException(), null);
  }
}
