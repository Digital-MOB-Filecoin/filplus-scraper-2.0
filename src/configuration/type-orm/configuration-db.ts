import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const dbHost = process.env.DB_HOST;
const dbUsername = process.env.DB_USERNAME;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_DATABASE_NAME;

export default new DataSource({
  type: 'postgres',
  host: dbHost,
  port: 5432,
  username: dbUsername,
  password: dbPassword,
  database: dbName,
  entities: ['dist/src/**/entities/*.js'],
  migrations: ['dist/migrations/*.js'],
});
