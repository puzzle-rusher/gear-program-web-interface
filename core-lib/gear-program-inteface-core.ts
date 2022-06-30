import { GearApi, Metadata, Hex, MessageEnqueued, MessagesDispatched, ProgramChanged, PayloadType } from '@gear-js/api';
import { web3FromSource } from '@polkadot/extension-dapp';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { UnsubscribePromise } from '@polkadot/api/types';
import { ISubmittableResult } from '@polkadot/types/types';

interface Account extends InjectedAccountWithMeta {
  decodedAddress: Hex;
  balance: { value: string; unit: string };
}

export type { Account };

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
    value,
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
  messageModel: MessageModel,
  callback: (ISubmittableResult) => void,
  meta?: Metadata,
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
  programId: Hex,
  payload: PayloadType,
  meta?: Buffer,
) => {
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
  value?: number;
  initPayload: PayloadType;
  payloadType?: string;
}

export interface MessageModel {
  destination: Hex;
  payload: PayloadType;
  value?: number;
}