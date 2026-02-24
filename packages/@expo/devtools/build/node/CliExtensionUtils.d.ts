import type { ExpoCliExtensionAppInfo } from './CliExtension.types';
export declare class SendMessageError extends Error {
    app: ExpoCliExtensionAppInfo;
    constructor(message: string, app: ExpoCliExtensionAppInfo);
}
