import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { Channel, Message } from 'amqplib';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppConfig } from '../../configuration/configuration.service';
import { LotusService } from '../../lotus/lotus.service';
import { RabbitMQService } from '../../rabbitmq/rabbitmq.service';
import { IConsumer } from '../../rabbitmq/rabbitmq.types';
import { getAllowanceMsgType } from '../scraper.types';
import { Verifier } from '../../../../submodules/filecoin-plus-scraper-entities/verifier.entity';

@Injectable()
export class UpdateMultisigAddressConsumer implements IConsumer {
  public queue = 'updateMultisigAddress';

  constructor(
    private httpService: HttpService,
    @InjectRepository(Verifier)
    private verifiersRepository: Repository<Verifier>,
    protected readonly config: AppConfig,
    protected lotus: LotusService,
    @Inject('ASYNC_RABBITMQ_CONNECTION')
    protected readonly rabbitMQService: RabbitMQService,
  ) { }

  public async exec(msg: string, channel: Channel, brokerMsg: Message) {
    try {
      const message = JSON.parse(msg);
      const address = message.address;

      const getFilfoxData = await this.httpService
        .get(`https://filfox.info/en/address/${address}`)
        .toPromise();
      const filfoxData = getFilfoxData.data;

      let robustAddress = filfoxData.match(
        /Robust Address <\/p><p class="flex w-3\/4"><span><span><span class="el-tooltip plain break-all">(.*?)<\/span>/g,
      );
      robustAddress = robustAddress[0];

      robustAddress = robustAddress.replace(
        'Robust Address </p><p class="flex w-3/4"><span><span><span class="el-tooltip plain break-all">',
        '',
      ).replace('</span>', '').replace(/\W/g, '');
      robustAddress = robustAddress.replace('</span>', '');

      const verifier = await this.verifiersRepository.findOne({
        where: {
          addressId: address,
        },
      });
      verifier.address = '-';
      if (robustAddress) {
        verifier.address = robustAddress;
      }
      await this.verifiersRepository.save(verifier);

      channel.ack(brokerMsg);
    } catch (e) {
      console.log(e);
      channel.ack(brokerMsg);
      //this.rabbitMQService.retry('scraper', this.queue, msg).catch(() => {});
    }
  }
}
