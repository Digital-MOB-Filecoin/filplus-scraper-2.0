import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  EVENT_TYPE,
  MetricsApiParams,
} from '../../../submodules/filecoin-plus-scraper-entities/botEvent';

export class StoreGlifDataCapRequestDto {
  @IsString()
  githubId: string;

  @IsString()
  messageId: string;
}

export class StoreGhDataCapRequestDto {
  @IsString()
  messageId: string;

  @IsNumber()
  issueId: number;

  @IsString()
  verifierAddressId: string;

  @IsString()
  applicantName: string;

  @IsString()
  @IsOptional()
  applicantLocation: string;
}

export class StoreBotEventDto {
  @IsString()
  environment: string;

  @IsString()
  repo: string;

  @IsOptional()
  @IsString()
  uuid: string;

  issueNumber: any;

  @IsDateString()
  timeStamp: Date;

  @IsEnum(EVENT_TYPE)
  eventType: EVENT_TYPE;

  @IsObject()
  params: MetricsApiParams;
}

export class DateIntervalDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
