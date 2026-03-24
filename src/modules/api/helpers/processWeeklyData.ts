import { DateIntervalDto } from '../api.dto';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { castToDates, validateStartDateWithEndDate } from './dateInterval';

dayjs.extend(isoWeek);

export const convertToIsoWeekDates = (
  startDate: Date,
  endDate: Date,
): { startOfWeekStartDate: dayjs.Dayjs; startOfWeekEndDate: dayjs.Dayjs } => {
  const convertToIsoWeek = (date: Date): dayjs.Dayjs =>
    dayjs(date).startOf('isoWeek');
  const startOfWeekStartDate = convertToIsoWeek(startDate);
  const startOfWeekEndDate = convertToIsoWeek(endDate);

  return { startOfWeekStartDate, startOfWeekEndDate };
};

export const queryBaseWhereCondition = (
  startOfWeekStartDate: dayjs.Dayjs,
  startOfWeekEndDate: dayjs.Dayjs,
) => `to_date(concat("year","week"), 'iyyyiw') >= '${startOfWeekStartDate.toISOString()}' and
        to_date(concat("year","week"), 'iyyyiw') <= '${startOfWeekEndDate.toISOString()}'`;

export const getQueryBaseWhereCondition = (
  weeklyDataByDateIntervalDto: DateIntervalDto,
): string => {
  const { startDate, endDate } = castToDates(weeklyDataByDateIntervalDto);
  validateStartDateWithEndDate(startDate, endDate);
  const { startOfWeekStartDate, startOfWeekEndDate } = convertToIsoWeekDates(
    startDate,
    endDate,
  );

  return queryBaseWhereCondition(startOfWeekStartDate, startOfWeekEndDate);
};
