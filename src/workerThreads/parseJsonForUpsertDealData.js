import * as request from 'request';
import * as amqp from 'amqplib/callback_api';
import * as JSONStream from 'JSONStream';
import { workerData } from 'worker_threads';
import { logStringPrefix } from './config';
import JSONStream from 'JSONStream';
import * as fs from 'fs';
import * as split2 from "split2";

console.log(`${logStringPrefix} on start ${new Date().toISOString()}`);

let enqueued = 0;
const numberOfElementsToEnqueue = 1000;
const numberOfUint32ValuesPerDeal = 7;
const numberOfAddressValuesPerDeal = 2;
const numberOfBignumberValuesPerDeal = 1;
const numberOfCidValuesPerDeal = 1;

const generateBufferAndView = () => {
  const arrayBuffer = new ArrayBuffer(
    Uint32Array.BYTES_PER_ELEMENT +
    Uint32Array.BYTES_PER_ELEMENT *
    numberOfUint32ValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint8Array.BYTES_PER_ELEMENT *
    41 *
    numberOfAddressValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint8Array.BYTES_PER_ELEMENT *
    14 *
    numberOfBignumberValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint8Array.BYTES_PER_ELEMENT *
    64 *
    numberOfCidValuesPerDeal *
    numberOfElementsToEnqueue,
  );
  const uint32View = new Uint32Array(
    arrayBuffer,
    4,
    Uint32Array.BYTES_PER_ELEMENT *
    numberOfUint32ValuesPerDeal *
    numberOfElementsToEnqueue,
  );
  const addressView = new Uint8Array(
    arrayBuffer,
    Uint32Array.BYTES_PER_ELEMENT *
    numberOfUint32ValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint32Array.BYTES_PER_ELEMENT,
  );
  const bigNumberView = new Uint8Array(
    arrayBuffer,
    Uint8Array.BYTES_PER_ELEMENT *
    41 *
    numberOfAddressValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint32Array.BYTES_PER_ELEMENT *
    numberOfUint32ValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint32Array.BYTES_PER_ELEMENT,
  );
  const cidView = new Uint8Array(
    arrayBuffer,
    Uint8Array.BYTES_PER_ELEMENT *
    41 *
    numberOfAddressValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint32Array.BYTES_PER_ELEMENT *
    numberOfUint32ValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint8Array.BYTES_PER_ELEMENT *
    14 *
    numberOfBignumberValuesPerDeal *
    numberOfElementsToEnqueue +
    Uint32Array.BYTES_PER_ELEMENT,
  );
  const extraInfoView = new Uint32Array(arrayBuffer, 0, 1);

  return {
    arrayBuffer,
    uint32View,
    addressView,
    bigNumberView,
    extraInfoView,
    uint32ViewBufferIndex: 0,
    addressViewBufferIndex: 0,
    bigNumberViewBufferIndex: 0,
    cidView,
    cidViewBufferIndex: 0,
  };
};

let {
  arrayBuffer,
  uint32View,
  addressView,
  bigNumberView,
  extraInfoView,
  uint32ViewBufferIndex,
  addressViewBufferIndex,
  bigNumberViewBufferIndex,
  cidView,
  cidViewBufferIndex,
} = generateBufferAndView();

amqp.connect(
  `amqp://${workerData.username}:${workerData.password}@${workerData.hostname}`,
  function (error0, connection) {
    if (error0) {
      throw error0;
    }

    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }
      const queue = 'upsertDealData';
      const stream = fs.createReadStream(workerData.dealDataFilePath).pipe(split2());

      stream.on('data', function (jsonString) {
        const data = JSON.parse(jsonString);
        if (data.Proposal.VerifiedDeal === false) {
          return;
        }

        uint32View[uint32ViewBufferIndex] = +data.State.SectorStartEpoch;
        uint32View[uint32ViewBufferIndex + 1] = +data.DealID;
        uint32View[uint32ViewBufferIndex + 2] =
          +data.Proposal.StoragePricePerEpoch;
        uint32View[uint32ViewBufferIndex + 3] = +data.Proposal.StartEpoch;
        uint32View[uint32ViewBufferIndex + 4] = +data.Proposal.EndEpoch;

        const bigIntValue = BigInt(
          data.State.SectorNumber ? data.State.SectorNumber : 0,
        );

        // Split the 64-bit integer into two 32-bit integers
        const low32 = Number(bigIntValue & BigInt(0xffffffff));
        const high32 = Number(bigIntValue >> BigInt(32));

        uint32View[uint32ViewBufferIndex + 5] = low32;
        uint32View[uint32ViewBufferIndex + 6] = high32;

        const paddedClientAddress = Buffer.from(
          data.Proposal.Client.padStart(41, '0'),
        );
        const paddedProviderAddress = Buffer.from(
          data.Proposal.Provider.padStart(41, '0'),
        );
        const paddedPieceCid = Buffer.from(
          data.Proposal.PieceCID['/'].padStart(64, '0'),
        );

        for (let i = 0; i < 41; i++) {
          addressView[addressViewBufferIndex + i] =
            paddedClientAddress.readUInt8(i);
          addressView[addressViewBufferIndex + 41 + i] =
            paddedProviderAddress.readUInt8(i);
        }

        for (let i = 0; i < 64; i++) {
          cidView[cidViewBufferIndex + i] = paddedPieceCid.readUInt8(i);
        }

        const paddedPieceSize = Buffer.from(
          data.Proposal.PieceSize.toString().padStart(14, '0'),
        );

        for (let i = 0; i < 14; i++) {
          bigNumberView[bigNumberViewBufferIndex + i] =
            paddedPieceSize.readUInt8(i);
        }

        enqueued++;

        if (enqueued % numberOfElementsToEnqueue === 0) {
          extraInfoView[0] = workerData.lastBlockHeight;

          channel.sendToQueue(queue, Buffer.from(arrayBuffer));
          const newBufferAndView = generateBufferAndView();

          arrayBuffer = newBufferAndView.arrayBuffer;
          uint32View = newBufferAndView.uint32View;
          addressView = newBufferAndView.addressView;
          bigNumberView = newBufferAndView.bigNumberView;
          extraInfoView = newBufferAndView.extraInfoView;
          uint32ViewBufferIndex = newBufferAndView.uint32ViewBufferIndex;
          addressViewBufferIndex = newBufferAndView.addressViewBufferIndex;
          bigNumberViewBufferIndex = newBufferAndView.bigNumberViewBufferIndex;
          cidView = newBufferAndView.cidView;
          cidViewBufferIndex = newBufferAndView.cidViewBufferIndex;

          // stream.end();
        } else {
          uint32ViewBufferIndex =
            uint32ViewBufferIndex + numberOfUint32ValuesPerDeal;
          addressViewBufferIndex =
            addressViewBufferIndex + 41 * numberOfAddressValuesPerDeal;
          bigNumberViewBufferIndex =
            bigNumberViewBufferIndex + 14 * numberOfBignumberValuesPerDeal;
          cidViewBufferIndex =
            cidViewBufferIndex + 64 * numberOfCidValuesPerDeal;
        }
      });

      stream.on('end', () => {
        const leftoverDealCount = enqueued % numberOfElementsToEnqueue;
        extraInfoView[0] = workerData.lastBlockHeight;

        if (leftoverDealCount) {
          channel.sendToQueue(queue, Buffer.from(arrayBuffer));
        }

        console.log(
          `${logStringPrefix} on json stream end ${new Date().toISOString()}`,
        );
        setTimeout(() => {
          connection.close();
        }, 3000);
        setTimeout(() => {
          process.exit(0);
        }, 5000);
      });
    });
  },
);
