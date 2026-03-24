import { LotusClient } from 'filecoin.js';
import { HttpService } from '@nestjs/axios';

export class GlifWrapper {
  constructor(private httpService: HttpService, private credentials: string) {}

  async glifReq(method: string, params: any) {
    const res = await this.httpService
      .post(`https://api.node.glif.io/`, {
        id: 0,
        jsonrpc: '2.0',
        method: method,
        params: params,
      })
      .toPromise();
    if (!res.data.result) console.log(res);
    return res.data.result;
  }

  async chainGetTipSetByHeight(height) {
    return await this.glifReq('Filecoin.ChainGetTipSetByHeight', [
      height,
      null,
    ]);
  }

  async chainHead() {
    return await this.glifReq('Filecoin.ChainHead', []);
  }

  ChainHead;
  async chainReadObj(cid) {
    return await this.glifReq('Filecoin.ChainReadObj', [cid]);
  }

  async stateAccountKey(id) {
    return await this.glifReq('Filecoin.StateAccountKey', [id, null]);
  }

  async chainGetParentMessages(cid) {
    return await this.glifReq('Filecoin.ChainGetParentMessages', [cid]);
  }

  async stateReadState(address, tipset) {
    return await this.glifReq('Filecoin.StateReadState', [address, tipset]);
  }

  async stateDecodeParams(to, methods, param) {
    return await this.glifReq('Filecoin.StateDecodeParams', [
      to,
      methods,
      param,
      null,
    ]);
  }
}

export class LotusWrapper {
  constructor(public client: LotusClient, public infuraWrapper: GlifWrapper) {}

  async chainGetTipSetByHeight(height) {
    if (this.client) {
      return await this.client.chain.getTipSetByHeight(height);
    }
    if (this.infuraWrapper) {
      return await this.infuraWrapper.chainGetTipSetByHeight(height);
    }
  }

  async chainReadObj(cid) {
    if (this.client) {
      return await this.client.chain.readObj(cid);
    }
    if (this.infuraWrapper) {
      return await this.infuraWrapper.chainReadObj(cid);
    }
  }

  async stateAccountKey(id) {
    if (this.client) {
      return await this.client.state.accountKey(id);
    }
    if (this.infuraWrapper) {
      return await this.infuraWrapper.stateAccountKey(id);
    }
  }

  async stateLookupId(address) {
    if (this.client) {
      return await this.client.state.lookupId(address);
    }
    if (this.infuraWrapper) {
      return '';
    }
  }

  async chainGetParentMessages(cid) {
    if (this.client) {
      return await this.client.chain.getParentMessages(cid);
    }
    if (this.infuraWrapper) {
      return await this.infuraWrapper.chainGetParentMessages(cid);
    }
  }

  async stateReadState(address, tipset) {
    if (this.client) {
      return await this.client.state.readState(address, tipset);
    }
    if (this.infuraWrapper) {
      return await this.infuraWrapper.stateReadState(address, tipset);
    }
  }
}
