/// <reference types="node" />
import { GearApi, Metadata, Hex, PayloadType } from '@gear-js/api';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
interface Account extends InjectedAccountWithMeta {
    decodedAddress: Hex;
    balance: {
        value: string;
        unit: string;
    };
}
export type { Account };
export declare const UploadProgram: (api: GearApi, account: Account, file: File, programModel: UploadProgramModel, callback: (Hex: any) => void) => Promise<void>;
export declare const Action: (api: GearApi, account: Account, meta: Metadata, messageModel: MessageModel, callback: (ISubmittableResult: any) => void) => Promise<void>;
export declare const ProgramState: (api: GearApi, stateModel: ProgramStateModel) => Promise<import("@polkadot/types/types").Codec>;
export interface UploadProgramModel {
    id?: string;
    meta?: Metadata;
    value: number;
    initPayload: PayloadType;
    payloadType?: string;
}
export interface MessageModel {
    destination: Hex;
    payload: PayloadType;
    value?: number;
}
export interface ProgramStateModel {
    programId: Hex;
    meta?: Buffer;
    payload?: PayloadType;
}
