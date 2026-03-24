import { NestFactory } from '@nestjs/core';
import * as helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';

import { AppModule } from './app.module';
import { AppConfig } from './modules/configuration/configuration.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiModule } from './modules/api/api.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'debug', 'log'],
  });
  const config = app.get(AppConfig);
  const port = config.values.app.port;

  app.enableCors({ origin: true });
  app.use(helmet());
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe());

  const options = new DocumentBuilder()
    .setTitle('Datacapstats scraper API')
    .setDescription(
      `Datacapstats scraper API description. For the enpoints that are marked as passtrough in the docs please refer to https://api.datacapstats.io/docs for details. <br/>
      For the passtrough endpoints you need to use the api key you obtain on api.datacapstats.io and for the rest you need to use the api key you get on https://api.filplus.d.interplanetary.one/`,
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-KEY', in: 'header' }, 'Api-Key')
    .build();
  const document = SwaggerModule.createDocument(app, options, {
    include: [ApiModule],
  });
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  console.log('FILECOIN PLUS BACKEND APP INITIATED!');
}

bootstrap();
