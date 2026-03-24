import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

export function ApiCommonQueryParams() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      description: 'Page number, starting from 1',
      example: 0,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'Number of elements per page',
      example: 10,
    }),
    ApiQuery({
      name: 'filter',
      required: false,
      description: 'String value to search / filter by',
    }),
    ApiQuery({
      name: 'sort',
      required: false,
      example: `[["id",1]]`,
      description:
        'Json encoded array of arrays describing sorting criteria. Each element of the top level array is an array with two elements, first one is the property name to sort by and the second is 1 for ascending order, 0 for descending',
    }),
  );
}
