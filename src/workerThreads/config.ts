export const workerThreadFilePath =
  __dirname + '/parseJsonForUpsertDealData.js';

export const logStringPrefix = '[workerThread:parseJsonForUpsertDealData]';

export const workerBackfillThreadFilePath =
  __dirname + '/parseJsonToBackfillSectorEvents.js';

export const logBackfillStringPrefix =
  '[workerThread:parseJsonToBackfillSectorEvents]';

export const workerUnifiedDealsThreadFilePath =
  __dirname + '/parseJsonForUpsertUnifiedDealData.js';

export const logUnifiedDealsStringPrefix =
  '[workerThread:parseJsonForUpsertUnifiedDealData]';
