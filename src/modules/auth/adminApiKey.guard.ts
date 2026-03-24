import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminApiKeyGuard extends AuthGuard('header_apikey_admin') {}
