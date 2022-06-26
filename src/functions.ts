import { GearApi, GearKeyring, getWasmMetadata, Metadata, Hex, MessageEnqueued, MessagesDispatched, ProgramChanged} from '@gear-js/api';
import { web3Accounts, web3FromSource } from '@polkadot/extension-dapp';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { UnsubscribePromise } from '@polkadot/api/types';

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
    callback: () => void
) => {
    const injector = await web3FromSource(account.meta.source);
    const fileBuffer = Buffer.from((await readFileAsync(file)) as ArrayBufferLike);
  
    const { value, initPayload, meta, title, programName, payloadType } = programModel;
    const gasLimit1 = await api.program.calculateGas.init(
      `0x${account.address}`,
      fileBuffer,
      programModel.initPayload,
      0,
      false,
      meta
    );

    console.log("GAS SPENT", gasLimit1.toNumber());
    const program = {
      code: fileBuffer,
      gasLimit: gasLimit1.toString(),
      salt: null,
      value: value.toString(),
      initPayload,
    };
  
    const name = programName ?? file.name;
  
    const alertTitle = 'gear.submitProgram';
    
    try {
      const { programId } = api.program.submit(program, meta, payloadType);
  
      const getProgramUploadStatus = waitForProgramInit(api, programId);
  
      await api.program.signAndSend(account.address, { signer: injector.signer }, (data) => {
        if (data.status.isFinalized) {  
          data.events.forEach(({ event: { method } }) => {
            if (method === 'MessageEnqueued') {
              callback();
            }
          });
        }
      });
  
      await getProgramUploadStatus();
    } catch (error) {
    }
};

export const waitForProgramInit = (api: GearApi, programId: string) => {
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
                // eslint-disable-next-line prefer-promise-reject-errors
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

export function readFileAsync(file: File) {
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
    title?: string;
    initPayload: string;
    programName?: string;
    payloadType?: string;
}

export interface ProgramModel {
    id: string;
    blockHash?: string;
    programNumber?: number;
    name?: string;
    owner: string;
    callCount?: number;
    timestamp: string;
    initStatus: ProgramStatus;
    title?: string;
    meta?: any;
}

export enum ProgramStatus {
    Success = 'success',
    Failed = 'failed',
    InProgress = 'in progress',
}

export async function deploy() {
    const gearApi = await GearApi.create();
    // const jsonKeyring = readFileSync(process.env.PATH_TO_KEYS).toJSON;
    // const account = GearKeyring.fromJson(jsonKeyring.toString(), process.env.PASSWORD);
    const path = '../rock_paper_scissors.opt.wasm';
    const metaPath = '../rock_paper_scissors.meta.wasm'
    const metaFile = Buffer.from(await (await fetch(metaPath)).arrayBuffer());
    const meta =  await getWasmMetadata(metaFile);

    const file = new File([await (await fetch(path)).blob()], path);

    const accs = (await web3Accounts())[0];
    const acc: Account = {
      ...accs,
      decodedAddress: GearKeyring.decodeAddress(accs.address),
      balance: { 
        value: '0', 
        unit: 'sd',
      },
    }
    const initMTK = {
      lol: "sdf",
      lol1: "swersdafd",
    };

    const programOptions: UploadProgramModel = {
      meta,
      value: 0,
      title: '',
      programName: 'first',
      payloadType: void 0,
      initPayload: JSON.stringify(initMTK),
    };
  
    UploadProgram(gearApi, acc, file, programOptions, function() {
      console.log("omg")
    })
}

// export async function send(payload: any, destination:  Buffer | `0x${string}`) {
//     const gearApi = await GearApi.create();
//     const account = await GearKeyring.fromMnemonic(process.env.MNEMONIC);

//     const metaFile = readFileSync(process.env.META_WASM);
//     const meta =  await getWasmMetadata(metaFile);
//     console.log(account);

//     const gas = await gearApi.program.gasSpent.handle(
//         `0x${account.address}`,
//         destination,
//         payload,
//         10010,
//         meta,
//     );
//     console.log('GAS SPENT', gas.toHuman());

//     try {
//         const message = {
//             destination: destination.toString(),
//             payload,
//             gasLimit: gas,
//             value: 10010
//         };
//         await gearApi.message.submit(message, meta);
//     } catch (error) {
//     console.error(`${error.name}: ${error.message}`);
//     }
//     try {
//     await gearApi.message.signAndSend(account, (event) => {
//         console.log(event.toHuman());
//     });
//     } catch (error) {
//     console.error(`${error.name}: ${error.message}`);
//     }
// }

// export async function subscribe() {
//     const gearApi = await GearApi.create();

//     const metaFile = process.env.META_WASM ? readFileSync(process.env.META_WASM) : undefined;
//     const meta = metaFile ? await getWasmMetadata(metaFile) : undefined;

//     gearApi.gearEvents.subscribeToLogEvents(({ data: { id, source, payload, reply } }) => {
//         console.log(`
//           Log:
//           messageId: ${id.toHex()}
//           from program: ${source.toHex()}
//         payload: ${
//            payload.toHuman()
//             }
//         ${
//           reply.isSome
//             ? `reply to: ${reply.unwrap()[0].toHex()}
//           with error: ${reply.unwrap()[1].toNumber() === 0 ? false : true}
//           `
//             : ''
//         }
//         `);

//         try {
//           console.log(CreateType.create(meta.handle_output, payload, meta).toHuman())
//         } catch (error) {
//           console.log(error);
//         }
//       });

//     gearApi.gearEvents.subscribeToProgramEvents(({ method, data: { info, reason } }) => {
//         console.log(`
//         ${method}:
//         programId: ${info.programId.toHex()}
//         initMessageId: ${info.messageId.toHex()}
//         origin: ${info.origin.toHex()}
//         ${reason ? `reason: ${reason.toHuman()}` : ''}
//         `);
//     });
// }

// export async function read_state(): Promise<Codec>{
//     const gearApi = await GearApi.create();
//     const metaWasm = readFileSync(process.env.META_WASM);
//     const current_state = await gearApi.programState.read(process.env.PROGRAM_ID, metaWasm, { CurrentState: null });
//     return current_state;
// }