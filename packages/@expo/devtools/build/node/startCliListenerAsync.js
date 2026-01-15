"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCliListenerAsync = void 0;
let didWarnAboutUsage = false;
/**
 * Dummy implementation of the `startDevToolsPluginListenerAsync` function for platforms
 * that do not support it, such as web or non-native environments.
 */
const startCliListenerAsync = async (_pluginName) => {
    if (!didWarnAboutUsage) {
        didWarnAboutUsage = true;
        console.warn('The startCliListenerAsync function is not supported on this platform. Please use the native version instead.');
    }
    return {
        addMessageListener: () => { },
        sendMessageAsync: () => Promise.resolve(),
    };
};
exports.startCliListenerAsync = startCliListenerAsync;
