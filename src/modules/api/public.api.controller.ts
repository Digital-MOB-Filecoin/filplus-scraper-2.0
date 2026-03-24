import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Options,
  Param,
  Request,
  Response,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/apiKey.guard';
import { ApiService } from './api.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import * as dayjs from 'dayjs';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { ApiCommonQueryParams } from '../utils/documentation';

const LIMIT = 4000;
const TTL = 60;

@Controller('public')
@ApiSecurity('Api-Key')
export class PublicApiController {
  constructor(private readonly apiService: ApiService) {}

  @ApiOperation({
    summary: 'Check scraper health',
    description: 'Returns status 200 if scraper is healthy, 503 otherwise',
  })
  @ApiCommonQueryParams()
  @Get('/api/health')
  async health(): Promise<any> {
    await this.apiService.health();
  }

  @ApiOperation({
    summary: 'Check api health',
    description: 'Returns status 200 if scraper api is healthy, 503 otherwise',
  })
  @ApiCommonQueryParams()
  @Get('/api/health-api')
  async health_api(): Promise<any> {
    await this.apiService.health_api();
  }
  @ApiOperation({
    summary: 'Retrieve verifiers / notaries list',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @Get('/api/getVerifiers')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getVerifiers(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve verified clients list',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @Get('/api/getVerifiedClients')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getVerifiedClients(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve verified clients list for a given verifier / notary',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @ApiParam({ name: 'verifierAddressId' })
  @Get('/api/getVerifiedClients/:verifierAddressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getVerifiedClientsFiltered(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve verified deals list',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @Get('/api/getVerifiedDeals')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getVerifiedDeals(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve deals list for a given verified client',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @ApiParam({ name: 'verifiedClientAddressId' })
  @Get('/api/getVerifiedDeals/:verifiedClientAddressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getVerifiedDealsFiltered(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve storage provider list',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @Get('/api/getMiners')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getMiners(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve storage provider info',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @ApiParam({ name: 'minerAddressId' })
  @Get('/api/getMinerInfo/:minerAddressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getMinersFiltered(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve deal allocation stats for a verified client',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiParam({ name: 'verifiedClientAddressId' })
  @Get('/api/getDealAllocationStats/:verifiedClientAddressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getDealAllocationStats(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve deal allocation stats for a verifier',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiParam({ name: 'verifierAddressId' })
  @Get('/api/getDealAllocationStatsByVerifier/:verifierAddressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getDealAllocationStatsByVerifier(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve graph data for allowance graph',
    description: 'Passtrough to datacapstats.io',
  })
  @Get('/api/getAllowanceHistoricData')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getAllowanceHistoricData(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve basic stats about the ecosystem',
    description: 'Passtrough to datacapstats.io',
  })
  @Get('/api/getFilPlusStats')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getFilPlusStats(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve enhanced stats about the ecosystem',
    description: 'Passtrough to datacapstats.io',
  })
  @Get('/api/getFilPlusExtraStats')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getFilPlusExtraStats(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  // @Get('/api/getApiKeyChallenge/:githubId')
  // @UseGuards(ThrottlerGuard)
  // @Throttle(1, 60)
  // async getApiKeyChallenge(@Param('githubId') githubId: string = '') {
  //   if (githubId === '') return '';
  //   const challenge = await this.apiService.getApiKeyRequest(githubId);
  //   return challenge;
  // }

  // @Get('/api/getApiKey/:gistId')
  // @UseGuards(ThrottlerGuard)
  // @Throttle(1,60)
  // async getApiKey(@Param('gistId') gistId: string = '') {
  //   if (gistId === '') return '';
  //   const apiKey = await this.apiService.getApiKey(gistId);
  //   return apiKey;
  // }

  @ApiOperation({
    summary: 'Get api key',
    description: 'Generates a new api key to use with this api',
  })
  @Get('/api/getApiKey')
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { limit: 1, ttl: 60 } })
  async getApiKey() {
    const apiKey = await this.apiService.getSimpleApiKey();
    return apiKey;
  }

  @ApiOperation({
    summary: 'Retrieve allowance info for verified client',
    description:
      'This endpoint returns information about the allowances that this verified client received',
  })
  @ApiParam({ name: 'addressId' })
  @Get('/api/getAllowanceForAddress/:addressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getAllowanceForAddress(@Param('addressId') addressId: string = '') {
    const clientDetails = await this.apiService.getAllowanceForAddress(
      addressId,
    );
    return clientDetails;
  }

  @ApiOperation({
    summary: 'Retrieve miner graph data',
    description: 'Passtrough to datacapstats.io',
  })
  @Get('/api/getWeeklyDataForMinerByInterval')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  @UseInterceptors(ClassSerializerInterceptor)
  getWeeklyDataForMinerByInterval(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve data for client datacap usage graph',
    description: 'Passtrough to datacapstats.io',
  })
  @Get('/api/getWeeklyDataForClientByInterval')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  @UseInterceptors(ClassSerializerInterceptor)
  getWeeklyDataForClientByInterval(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve TTD graph data',
    description: 'Passtrough to datacapstats.io',
  })
  @Get('/api/getWeeklyDataForTTDByInterval')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  @UseInterceptors(ClassSerializerInterceptor)
  getWeeklyDataForTTDByInterval(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve LDN allowances list',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @Get('/api/getLdnAllowances')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getLdnAllowances(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve LDN allowances list for a given verified client',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @ApiParam({ name: 'clientAddressId' })
  @Get('/api/getLdnAllowancesForClient/:clientAddressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getLdnAllowancesForClient(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve LDN allowances list for a given verifier / notary',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @ApiParam({ name: 'verifierAddressId' })
  @Get('/api/getLdnAllowancesByVerifier/:verifierAddressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getLdnAllowancesByVerifier(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve allowances list for a given verified client',
    description: 'Passtrough to datacapstats.io',
  })
  @ApiCommonQueryParams()
  @ApiParam({ name: 'verifierAddressId' })
  @Get('/api/getAllowancesByVerifier/:verifierAddressId')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getAllowancesByVerifier(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiOperation({
    summary: 'Retrieve LDN v3 allowance',
    description:
      'Get the sum of all allowances received by the LDN v3 notary in the last 2 weeks',
  })
  @Get('/api/getAllowanceAssignedToLdnV3InLast2Weeks')
  @UseGuards(ApiKeyGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ Options: { ttl: TTL, limit: LIMIT } })
  async getAllowanceAssignedToLdnV3InLast2Weeks() {
    return {
      allowance: 0,
    };
  }
}
