var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { web3FromSource } from '@polkadot/extension-dapp';
export const UploadProgram = (api, account, file, programModel, callback) => __awaiter(void 0, void 0, void 0, function* () {
    const injector = yield web3FromSource(account.meta.source);
    const fileBuffer = Buffer.from((yield readFileAsync(file)));
    const { value, initPayload, meta, payloadType } = programModel;
    const gasLimit = yield api.program.calculateGas.init(account.decodedAddress, fileBuffer, initPayload, 0, true, meta);
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
        yield api.program.signAndSend(account.address, { signer: injector.signer }, (data) => {
            if (data.status.isFinalized) {
                data.events.forEach(({ event: { method } }) => {
                    if (method === 'MessageEnqueued') {
                        callback(programId);
                    }
                });
            }
        });
        yield getProgramUploadStatus();
    }
    catch (error) {
        console.log(error);
    }
});
export const Action = (api, account, meta, messageModel, callback) => __awaiter(void 0, void 0, void 0, function* () {
    const injector = yield web3FromSource(account.meta.source);
    const { destination, payload, value } = messageModel;
    const gasLimit = yield api.program.calculateGas.handle(account.decodedAddress, destination, payload, value, true, meta);
    const message = Object.assign(Object.assign({}, messageModel), { gasLimit: gasLimit.min_limit });
    try {
        yield api.message.submit(message, meta);
        yield api.message.signAndSend(account.address, { signer: injector.signer }, callback);
    }
    catch (error) {
        console.log(error);
    }
});
export const ProgramState = (api, stateModel) => __awaiter(void 0, void 0, void 0, function* () {
    const { programId, meta, payload } = stateModel;
    try {
        return yield api.programState.read(programId, meta, payload);
    }
    catch (error) {
        console.log(error);
    }
});
const waitForProgramInit = (api, programId) => {
    let unsub;
    let messageId;
    const initPromise = new Promise((resolve, reject) => {
        unsub = api.query.system.events((events) => {
            events.forEach(({ event }) => {
                switch (event.method) {
                    case 'MessageEnqueued': {
                        const meEvent = event;
                        if (meEvent.data.destination.eq(programId) && meEvent.data.entry.isInit) {
                            messageId = meEvent.data.id.toHex();
                        }
                        break;
                    }
                    case 'MessagesDispatched': {
                        const mdEvent = event;
                        for (const [id, status] of mdEvent.data.statuses) {
                            if (id.eq(messageId) && status.isFailed) {
                                reject('failed');
                                break;
                            }
                        }
                        break;
                    }
                    case 'ProgramChanged': {
                        const pcEvent = event;
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
    return () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield initPromise;
        (yield unsub)();
        return result;
    });
};
function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
//# sourceMappingURL=gear-program-inteface-core.js.map