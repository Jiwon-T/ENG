import type { RegistrationInput } from './studentRegistration';
export interface RegistrationSaveIntent {
    action: 'save-student-registration';
    requestId: string;
    writeId: string;
    revision?: number;
    data: RegistrationInput;
}
// Keep one immutable payload until the server confirms the write. A retry after a
// lost response must use both the same UUID and the same original input.
export function registrationSaveIntent(data:RegistrationInput, requestId:string, revision?:number):RegistrationSaveIntent {
    return {action:'save-student-registration',requestId,writeId:crypto.randomUUID(),...(revision === undefined ? {} : {revision}),data:structuredClone(data)};
}
export function registrationFailureIsDefinitive(status:number) {
    return status >= 400 && status < 500 && ![408,425,429].includes(status);
}
