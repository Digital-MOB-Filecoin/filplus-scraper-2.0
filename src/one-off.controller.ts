import { Controller, Get, UseGuards } from '@nestjs/common';
import { ENVIRONMENT } from 'submodules/filecoin-plus-scraper-entities/botEvent';
import { OneOffService } from './modules/scraper/oneOffService/oneOff.service';
import { AdminApiKeyGuard } from './modules/auth/adminApiKey.guard';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

@Controller()
@UseGuards(AdminApiKeyGuard)
export class OneOffController {
    constructor(
        private readonly oneOffService: OneOffService,
    ) { }

    @ApiExcludeEndpoint()
    @Get('/one-off/fixMissingSectorIdFromEventLog')
    async fixMissingSectorIdFromEventLog(): Promise<any> {
        return await this.oneOffService.fixMissingSectorIdFromEventLog();
    }
}
