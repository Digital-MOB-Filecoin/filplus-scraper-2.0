import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';
import * as fs from 'fs';
import * as path from 'path';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';

@Injectable()
export class FetchClaimsForProviderConsumer implements IConsumer {
    public queue = 'fetchClaimsForProvider';

    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,
    ) { }

    public async exec(msg: string, channel: Channel, brokerMsg: Message) {
        Logger.log(
            `Fetching claims for provider from message: ${msg}`,
            'FetchClaimsForProvider',
        );
        try {
            const message = JSON.parse(msg);
            const providerAddress = message.providerAddress;

            Logger.log(
                `Fetching claims for provider ${providerAddress}`,
                'FetchClaimsForProvider',
            );

            const lotusArchiveUrl = this.config.values.lotusArchive.url;
            const lotusArchiveToken = this.config.values.lotusArchive.token;

            const response = await fetch(lotusArchiveUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: lotusArchiveToken,
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'Filecoin.StateGetClaims',
                    params: [providerAddress, null],
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
            }

            const claims = data.result;
            const claimCount = claims ? Object.keys(claims).length : 0;

            Logger.log(
                `Fetched ${claimCount} claims for provider ${providerAddress}`,
                'FetchClaimsForProvider',
            );

            // Get the output directory from config
            const dealDataFilePath = this.config.values.dealDataFilePath;
            const outputDir = path.dirname(dealDataFilePath);

            console.log(`Output directory: ${outputDir}`);
            // Ensure the directory exists
            if (!fs.existsSync(outputDir)) {
                throw new Error(`Output directory does not exist: ${outputDir}`);
            }

            // Create output file path with provider address (no timestamp)
            const outputFileName = `claims-${providerAddress}.ndjson`;
            const outputFilePath = path.join(outputDir, outputFileName);

            // Write claims as NDJSON (one claim per line) using a write stream for memory efficiency
            const writeStream = fs.createWriteStream(outputFilePath);

            if (claims) {
                for (const [claimId, claim] of Object.entries(claims)) {
                    const claimWithId = { claimId, ...claim as object };
                    writeStream.write(JSON.stringify(claimWithId) + '\n');
                }
            }

            writeStream.end();

            // Wait for the stream to finish
            await new Promise<void>((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            Logger.log(
                `Saved ${claimCount} claims to ${outputFilePath}`,
                'FetchClaimsForProvider',
            );

            channel.ack(brokerMsg);
        } catch (e) {
            Logger.error(
                `Failed to fetch claims for provider: ${e.message}`,
                e.stack,
                'FetchClaimsForProvider',
            );
            channel.ack(brokerMsg);
            this.rabbitMQService
                .retry('scraper', this.queue, JSON.stringify(JSON.parse(msg)))
                .catch(() => { });
        }
    }
}
