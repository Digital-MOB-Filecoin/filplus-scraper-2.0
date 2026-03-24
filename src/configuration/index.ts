import { registerAs } from '@nestjs/config';

export default registerAs('config', () => {
  return {
    database: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE_NAME,
    },
    tracerDatabase: {
      host: process.env.TRACER_DB_HOST,
      port: parseInt(process.env.TRACER_DB_PORT, 10),
      username: process.env.TRACER_DB_USERNAME,
      password: process.env.TRACER_DB_PASSWORD,
      database: process.env.TRACER_DB_DATABASE_NAME,
    },
    scraperSecondaryDatabase: {
      host: process.env.SCRAPER_SECONDARY_DB_HOST,
      port: parseInt(process.env.SCRAPER_SECONDARY_DB_PORT, 10),
      username: process.env.SCRAPER_SECONDARY_DB_USERNAME,
      password: process.env.SCRAPER_SECONDARY_DB_PASSWORD,
      database: process.env.SCRAPER_SECONDARY_DB_DATABASE_NAME,
    },
    app: {
      port: parseInt(process.env.APP_PORT, 10),
    },
    lotus: {
      url: process.env.LOTUS_RPC_URL,
      wsUrl: process.env.LOTUS_WS_URL,
      token: process.env.LOTUS_TOKEN,
    },
    lotusArchive: {
      url: process.env.LOTUS_ARCHIVE_RPC_URL,
      token: process.env.LOTUS_ARCHIVE_RPC_TOKEN,
    },
    lotusBackup: {
      url: process.env.LOTUS_BACKUP_RPC_URL,
      wsUrl: process.env.LOTUS_BACKUP_WS_RPC_URL,
      token: process.env.LOTUS_BACKUP_TOKEN,
    },
    rabbitmq: {
      hostname: process.env.RABBITMQ_HOST,
      username: process.env.RABBITMQ_USER,
      password: process.env.RABBITMQ_PASSWORD,
    },
    github: {
      user: process.env.GH_USER,
      token: process.env.GH_TOKEN,
    },
    infura: {
      credentials: process.env.INFURA_CREDENTIALS,
    },
    mailgun: {
      apiKey: process.env.MAILGUN_API_KEY,
    },
    crons: {
      disable: +process.env.DISABLE_CRONS,
    },
    ldnV3: {
      addresses: ['f01858410', 'f02049625'],
    },
    glif: {
      autoverifierAddressId: 'f0121877',
      defaultClientName: 'Glif auto verified',
    },
    dealDataFilePath: process.env.PATH_TO_DEAL_DATA_FILE,
  };
});
