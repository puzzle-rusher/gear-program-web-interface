import { GearApi, GearKeyring, getWasmMetadata, Metadata, Hex, MessageEnqueued, MessagesDispatched, ProgramChanged, PayloadType} from '@gear-js/api';
import { web3Enable, web3Accounts, web3FromSource } from '@polkadot/extension-dapp';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { UnsubscribePromise } from '@polkadot/api/types';
import { ISubmittableResult } from '@polkadot/types/types';

interface Account extends InjectedAccountWithMeta {
  decodedAddress: Hex;
  balance: { value: string; unit: string };
}

export type { Account };
var programId: Hex;

export const UploadProgram = async (
    api: GearApi,
    account: Account,
    file: File,
    programModel: UploadProgramModel,
    callback: (Hex) => void
) => {
    const injector = await web3FromSource(account.meta.source);
    const fileBuffer = Buffer.from((await readFileAsync(file)) as ArrayBufferLike);
  
    const { value, initPayload, meta, payloadType } = programModel;
    
    const gasLimit = await api.program.calculateGas.init(
      account.decodedAddress,
      fileBuffer,
      initPayload,
      0,
      true,
      meta
    );

    console.log("GAS SPENT", gasLimit.toHuman());
    const program = {
      code: fileBuffer,
      gasLimit: gasLimit.min_limit,
      salt: null,
      value: value.toString(),
      initPayload,
    };
        
    try {
      const { programId } = api.program.submit(program, meta, payloadType);
      const getProgramUploadStatus = waitForProgramInit(api, programId);
  
      await api.program.signAndSend(account.address, { signer: injector.signer }, (data) => {
        if (data.status.isFinalized) {  
          data.events.forEach(({ event: { method } }) => {
            if (method === 'MessageEnqueued') {
              callback(programId);
            }
          });
        }
      });
  
      await getProgramUploadStatus();
    } catch (error) {
      console.log(error);
    }
};

export const Action = async (
  api: GearApi,
  account: Account,
  meta: Metadata,
  messageModel: MessageModel,
  callback: (ISubmittableResult) => void
) => {
  const injector = await web3FromSource(account.meta.source);
  const { destination, payload, value } = messageModel;
  
  const gasLimit = await api.program.calculateGas.handle(
    account.decodedAddress,
    destination,
    payload,
    value,
    true,
    meta,
  );

  const message = {
    ...messageModel,
    gasLimit: gasLimit.min_limit,
  };

  try {
    await api.message.submit(message, meta);
    await api.message.signAndSend(account.address, { signer: injector.signer }, callback);
  } catch (error) {
    console.log(error);
  }
};

export const ProgramState = async (
  api: GearApi,
  stateModel: ProgramStateModel,
) => {
  const { programId, meta, payload } = stateModel;

  try {
    return await api.programState.read(programId, meta, payload)
  } catch (error) {
    console.log(error);
  }
};

const waitForProgramInit = (api: GearApi, programId: string) => {
  let unsub: UnsubscribePromise;
  let messageId: Hex;

  const initPromise = new Promise<string>((resolve, reject) => {
    unsub = api.query.system.events((events: any) => {
      events.forEach(({ event }: any) => {
        switch (event.method) {
          case 'MessageEnqueued': {
            const meEvent = event as MessageEnqueued;

            if (meEvent.data.destination.eq(programId) && meEvent.data.entry.isInit) {
              messageId = meEvent.data.id.toHex();
            }

            break;
          }
          case 'MessagesDispatched': {
            const mdEvent = event as MessagesDispatched;

            for (const [id, status] of mdEvent.data.statuses) {
              if (id.eq(messageId) && status.isFailed) {
                reject('failed');
                break;
              }
            }

            break;
          }
          case 'ProgramChanged': {
            const pcEvent = event as ProgramChanged;

            if (pcEvent.data.id.eq(programId) && pcEvent.data.change.isActive) {
              resolve('success');
            }

            break;
          }
          default:
            break;
        }
      });
    });
  });

  return async () => {
    const result = await initPromise;

    (await unsub)();

    return result;
  };
};

function readFileAsync(file: File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
  
      reader.onload = () => {
        resolve(reader.result);
      };
  
      reader.onerror = reject;
  
      reader.readAsArrayBuffer(file);
    });
}

export interface UploadProgramModel {
    id?: string;
    meta?: Metadata;
    value: number;
    initPayload: PayloadType;
    payloadType?: string;
}

export interface MessageModel {
  destination: Hex,
  payload: PayloadType,
  value?: number,
}

export interface ProgramStateModel {
  programId: Hex;
  meta?: Buffer;
  payload?: PayloadType;
}

export enum ProgramStatus {
    Success = 'success',
    Failed = 'failed',
    InProgress = 'in progress',
}

async function getMeta() {
  const metaPath = './contract_files/rock_paper_scissors.meta.wasm';
  return Buffer.from(await (await fetch(metaPath)).arrayBuffer());
}

async function getCodeFile() {
  const path = './contract_files/rock_paper_scissors.opt.wasm';
  return new File([await (await fetch(path)).blob()], path);
}

async function getAccount() {
  await web3Enable('Gear App');
  const accs = (await web3Accounts())[2];
  return {
    ...accs,
    decodedAddress: GearKeyring.decodeAddress(accs.address),
    balance: { 
      value: '0', 
      unit: 'sd',
    },
  }
}

export async function deploy() {
    const gearApi = await GearApi.create();
    const metaFile = await getMeta();
    const meta =  await getWasmMetadata(metaFile);
    const file = await getCodeFile();
    const account = await getAccount();
    const initPayload = {
      bet_size: 100,
      lobby_players: [],
    };

    const programOptions: UploadProgramModel = {
      meta,
      value: 0,
      initPayload,
    };
  
    UploadProgram(gearApi, account, file, programOptions, function(program_id) {
      console.log(program_id);
      programId = program_id;
    })
}

export async function state() {
  const gearApi = await GearApi.create();
  const meta = await getMeta();

  const stateModel: ProgramStateModel = {
    programId,
    meta,
    payload: "BetSize",
  };

  const state = await ProgramState(gearApi, stateModel);
  console.log(state.toHuman());
}

export async function sendTransaction() {
  const gearApi = await GearApi.create();
  const metaBuffer = await getMeta();
  const meta = await getWasmMetadata(metaBuffer);
  const account = await getAccount();
  const model: MessageModel = {
    destination: programId,
    payload: {
      SetBetSize: 10000,
    },
  };

  Action(gearApi, account, meta, model, (event) => {
    console.log(event.toHuman());
  });
}