import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, Message } from 'amqplib';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

import { AppConfig } from '../../configuration/configuration.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';

@Injectable()
export class ProcessClaimsFileConsumer implements IConsumer {
    public queue = 'processClaimsFile';

    constructor(
        protected readonly config: AppConfig,
        @Inject('ASYNC_RABBITMQ_CONNECTION')
        protected readonly rabbitMQService: RabbitMQService,
    ) { }

    public async exec(msg: string, channel: Channel, brokerMsg: Message) {
        try {
            const message = JSON.parse(msg);
            const providerAddress = message.providerAddress;

            // Get the output directory from config
            const dealDataFilePath = this.config.values.dealDataFilePath;
            const outputDir = path.dirname(dealDataFilePath);

            // Build the expected file path
            const claimsFileName = `claims-${providerAddress}.ndjson`;
            const claimsFilePath = path.join(outputDir, claimsFileName);

            // Check if the file exists
            if (fs.existsSync(claimsFilePath)) {
                // Read the file in batches of 1000 rows
                const BATCH_SIZE = 1000;
                let batch: any[] = [];
                let batchNumber = 0;
                let totalRows = 0;

                const fileStream = fs.createReadStream(claimsFilePath);
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity,
                });

                for await (const line of rl) {
                    if (line.trim()) {
                        const claim = JSON.parse(line);
                        batch.push(claim);
                        totalRows++;

                        if (batch.length >= BATCH_SIZE) {
                            await this.publishBatch(batch, batchNumber, providerAddress);
                            batchNumber++;
                            batch = [];
                        }
                    }
                }

                // Process remaining rows
                if (batch.length > 0) {
                    await this.publishBatch(batch, batchNumber, providerAddress);
                    batchNumber++;
                }

                Logger.log(
                    `Published ${batchNumber} batch messages for provider ${providerAddress} (${totalRows} claims)`,
                    'ProcessClaimsFile',
                );
            } else {
                Logger.warn(
                    `Claims file not found for provider ${providerAddress}: ${claimsFilePath}`,
                    'ProcessClaimsFile',
                );
            }

            channel.ack(brokerMsg);
        } catch (e) {
            Logger.error(
                `Failed to process claims file: ${e.message}`,
                e.stack,
                'ProcessClaimsFile',
            );
            channel.ack(brokerMsg);
        }
    }

    /**
     * Publish a batch of claims to be processed by ProcessClaimsBatchConsumer
     * @param batch - Array of claim objects
     * @param batchNumber - The batch number (0-indexed)
     * @param providerAddress - The provider address
     */
    private async publishBatch(batch: any[], batchNumber: number, providerAddress: string): Promise<void> {
        await this.rabbitMQService.publish(
            'scraper',
            'processClaimsBatch',
            JSON.stringify({ batch, batchNumber, providerAddress }),
        );
    }
}
