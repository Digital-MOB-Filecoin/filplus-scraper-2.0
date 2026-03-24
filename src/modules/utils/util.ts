import { Cid } from 'filecoin.js/builds/dist/providers/Types';
import { LotusBackupService } from '../lotus-backup/lotus-backup.service';
// import * as cbor from 'ipld-dag-cbor';
import * as cbor from '@ipld/dag-cbor';
import * as address from '@glif/filecoin-address';
import BigNumber from 'bignumber.js';
import { decode } from '@ipld/dag-cbor';
import { LotusArchiveService } from '../lotus-archive/lotus.service';

export const d2h = (d) => {
  var s = (+d).toString(16);
  if (s.length < 2) {
    s = '0' + s;
  }
  return s;
};

export const populateAddressTuple = async (
  input: string,
  lotusClient: any,
  addressCache: any,
) => {
  for (const cacheItem of addressCache) {
    if (cacheItem.addressId == input || cacheItem.address == input) {
      return {
        address: cacheItem.address,
        addressId: cacheItem.addressId,
        isMultisig: !!cacheItem.isMultisig,
      };
    }
  }

  let address = '';
  let addressId = '';
  let isMultisig = false;

  if (input.indexOf('f0') == 0) {
    addressId = input;
  } else {
    address = input;
  }

  try {
    if (addressId != '') {
      address = await lotusClient.state.accountKey(addressId);
    }
  } catch (e) { }

  try {
    if (address != '') {
      addressId = await lotusClient.state.lookupId(address);
    }
  } catch (e) { }

  try {
    await lotusClient.msig.getAvailableBalance(address || addressId);

    isMultisig = true;
  } catch (e) { }

  return {
    address,
    addressId,
    isMultisig,
  };
};

function bytesToBig(p) {
  let acc = 0n;
  for (let i = 0; i < p.length; i++) {
    acc *= 256n;
    acc += BigInt(p[i]);
  }
  return acc;
}

export function decodeEventParam(value: string, flag: number) {
  const decodedValue: any = decode(Buffer.from(value, 'base64'));
  if (flag == 3 && decodedValue) return decodedValue.toString();

  if (flag == 1) {
    return decodedValue.toString();
  }

  return null;
}

const loadObj = async (cid: Cid, lotusClient: LotusArchiveService) => {
  let obj = await lotusClient.client.chain.readObj(cid);

  const deserializedObj = cbor.decode(Buffer.from(obj, 'base64'));

  return deserializedObj;
};

export const readObjectAsArray = async (
  cid: Cid,
  lotusClient: LotusArchiveService,
  version: number,
) => {
  let result = [];
  const items = await loadObj(cid, lotusClient);
  for (const item of items[1]) {
    if (Array.isArray(item)) {
      for (const subItem of item) {
        const prefix = new Uint8Array([0]);
        var mergedArray = new Uint8Array(prefix.length + subItem[0].length);
        mergedArray.set(prefix);
        mergedArray.set(subItem[0], prefix.length);

        result.push([
          address.encode(
            'f',
            new address.Address(version === 9 ? mergedArray : subItem[0]),
          ),
          bytesToBig(subItem[1]),
        ]);
      }
    } else {
      result = result.concat(
        await readObjectAsArray({ '/': item + '' }, lotusClient, version),
      );
    }
  }
  return result;
};

export function calculateTimestampFromHeight(height: number): number {
  return 1598306400 + 30 * height;
}

export function calculateHeightFromTimestamp(timestamp: number): number {
  return timestamp > 1598306400 ? (timestamp - 1598306400) / 30 : null;
}

export function displayName(
  name: string,
  orgName: string,
  fallback: string[] | undefined = undefined,
): string {
  if (name && !orgName) {
    return name;
  }
  if (!name && orgName) {
    return orgName;
  }

  if (name && orgName) {
    return `${name} - (${orgName})`;
  }

  return fallback?.find((item) => item) ?? '';
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export enum ByteConverter {
  'MiB' = '1048576',
  'GiB' = '1073741824',
  'TiB' = '1099511627776',
  'PiB' = '1125899906842624',
  'EiB' = '1152921504606846976',
}

export function convertToBytes(
  value: string | number,
  unit: ByteConverter,
): BigNumber {
  return new BigNumber(unit).multipliedBy(new BigNumber(value));
}
