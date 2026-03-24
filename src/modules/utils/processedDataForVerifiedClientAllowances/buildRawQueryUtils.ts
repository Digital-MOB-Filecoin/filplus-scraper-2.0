export function buildSelect(isCount = false) {
  return isCount
    ? 'select count(distinct id)'
    : 'select   distinct processed_data_for_verified_client_ldn_allowances.*';
}

export function buildFrom() {
  return 'from processed_data_for_verified_client_ldn_allowances';
}

export function buildWhere(filterItems: undefined | any[]) {
  if (!filterItems || filterItems.length === 0) {
    return '';
  }

  if (filterItems.length === 1) {
    const filterItem = filterItems[0];
    return `CROSS JOIN jsonb_array_elements(CASE jsonb_array_length(signers)
                                             WHEN 0 THEN '[{}]'                                                                                                                                                                                
                                             ELSE signers
                                            END)
          WHERE value ->> 'address' = '${filterItem}' OR
          value ->> 'addressId' = '${filterItem}' OR
          "clientAddress" = '${filterItem}' OR
          "clientAddressId" = '${filterItem}' OR
          "clientName" ilike '%${filterItem}%' OR
          value ->> 'name' ilike '%${filterItem}%'
          `;
  }

  const formattedFilterItems = filterItems
    .map((item) => `'${item}'`)
    .join(', ');

  return `CROSS JOIN jsonb_array_elements(CASE jsonb_array_length(signers)
                                             WHEN 0 THEN '[{}]'                                                                                                                                                                                
                                             ELSE signers
                                            END)
          WHERE value ->> 'address' IN (${formattedFilterItems}) OR
          value ->> 'addressId' IN (${formattedFilterItems}) OR
          "clientAddress" IN (${formattedFilterItems}) OR
          "clientAddressId" IN (${formattedFilterItems})`;
}

export enum OrderBy {
  DESC = 'DESC',
  ASC = 'ASC',
}

export function buildOrderBy(
  orderBy: string,
  orderDirection: OrderBy = OrderBy.ASC,
) {
  if (!orderBy) {
    return 'ORDER BY "timestamp" DESC';
  }

  if (orderBy !== 'clientAddressId') {
    return `ORDER BY "${orderBy}" ${orderDirection}`;
  }

  return `ORDER BY "clientAddressId" ${orderDirection}, "allowanceNumber" DESC`;
}

export function buildLimit(page: number, limit: number) {
  if (limit === 0 || page === 0) {
    return '';
  }

  return `LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
}
