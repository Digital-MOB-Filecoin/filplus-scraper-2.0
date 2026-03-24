import { DateIntervalDto } from '../api.dto';
import { UnprocessableEntityException } from '@nestjs/common';

export const castToDates = (
  dateIntervalDto: DateIntervalDto,
): { startDate: Date; endDate: Date } => {
  const { startDate, endDate } = dateIntervalDto;
  return { startDate: new Date(startDate), endDate: new Date(endDate) };
};

export const validateStartDateWithEndDate = (
  startDate: Date,
  endDate: Date,
): void => {
  if (startDate.getTime() >= endDate.getTime()) {
    throw new UnprocessableEntityException(
      'endDate must be greater than startDate',
    );
  }
};
