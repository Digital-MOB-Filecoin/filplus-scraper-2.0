import {
  Body,
  Controller,
  Get,
  Options,
  Post,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import {
  StoreBotEventDto,
  StoreGhDataCapRequestDto,
  StoreGlifDataCapRequestDto,
} from './api.dto';
import { ApiService } from './api.service';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
@UseGuards(ThrottlerGuard)
@Throttle({ Options: { limit: 60, ttl: 30 } })
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @ApiExcludeEndpoint()
  @Get('/api/getVerifiedClientsWithRetrievableData')
  async getVerifiedClientsWithRetrievableData() {
    const result = await this.apiService.getVerifiedClientsWithRetrievableData();
    return result;
  }

  @ApiExcludeEndpoint()
  @Get('/api/getVerifiers')
  async getVerifiers(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getVerifiedClients')
  async getVerifiedClients(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getVerifiedClients/:verifierAddressId')
  async getVerifiedClientsFiltered(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getVerifiedDeals')
  async getVerifiedDeals(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getVerifiedDeals/:verifiedClientAddressId')
  async getVerifiedDealsFiltered(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getMiners')
  async getMiners(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getMinerInfo/:minerAddressId')
  async getMinersFiltered(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getDealAllocationStats/:verifiedClientAddressId')
  async getDealAllocationStats(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getDealAllocationStatsByVerifier/:verifierAddressId')
  async getDealAllocationStatsByVerifier(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getAllowanceHistoricData')
  async getAllowanceHistoricData(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getFilPlusStats')
  async getFilPlusStats(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getFilPlusExtraStats')
  async getFilPlusExtraStats(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Post('/api/storeGlifDataCapRequest')
  async storeGlifDataCapRequest(
    @Body() storeGlifDataCapRequestDto: StoreGlifDataCapRequestDto,
  ) {
    const glifDataCapRequestId = await this.apiService.storeGlifDataCapRequest(
      storeGlifDataCapRequestDto.githubId,
      storeGlifDataCapRequestDto.messageId,
    );
    return glifDataCapRequestId;
  }

  @ApiExcludeEndpoint()
  @Post('/api/storeGhDataCapRequest')
  async storeGhDataCapRequest(
    @Body() storeGhDataCapRequestDto: StoreGhDataCapRequestDto,
  ) {
    const glifDataCapRequestId = await this.apiService.storeGhDataCapRequest(
      storeGhDataCapRequestDto.issueId,
      storeGhDataCapRequestDto.messageId,
      storeGhDataCapRequestDto.verifierAddressId,
      storeGhDataCapRequestDto.applicantName,
      storeGhDataCapRequestDto.applicantLocation,
    );
    return glifDataCapRequestId;
  }

  @ApiExcludeEndpoint()
  @SkipThrottle()
  @Post('/api/storeBotEvent')
  async storeBotEventRequest(@Body() storeBotEventDto: StoreBotEventDto) {
    const glifDataCapRequestId = await this.apiService.storeBotEventRequest(
      storeBotEventDto,
    );
    return glifDataCapRequestId;
  }

  @ApiExcludeEndpoint()
  @Get('/api/getLdnAllowances')
  async getLdnAllowances(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getLdnAllowancesForClient/:clientAddressId')
  async getLdnAllowancesForClient(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getLdnAllowancesByVerifier/:verifierAddressId')
  async getLdnAllowancesByVerifier(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/getClientsOfLdnSigner/:ldnSignerAddressId')
  getClientsOfLdnSigner(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }

  @ApiExcludeEndpoint()
  @Get('/api/findMsigMessage/:msgCID')
  findMsigMessage(@Request() req, @Response() res) {
    res.redirect(`https://api.datacapstats.io${req.url}`);
  }
}
