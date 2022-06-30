import { GearApi, GearKeyring, getWasmMetadata, Hex } from '@gear-js/api';
import { web3Enable, web3Accounts } from '@polkadot/extension-dapp';
import { UploadProgramModel, UploadProgram, ProgramStateModel, ProgramState, MessageModel, Action } from "gear-program-interface-core";

var programId: Hex;

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
  const account = (await web3Accounts())[2];
  return {
    ...account,
    decodedAddress: GearKeyring.decodeAddress(account.address),
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