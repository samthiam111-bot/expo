"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryAllInspectorAppsAsync = queryAllInspectorAppsAsync;
const node_fetch_1 = __importDefault(require("node-fetch"));
async function queryAllInspectorAppsAsync(metroServerOrigin) {
    const resp = await (0, node_fetch_1.default)(`${metroServerOrigin}/json/list`);
    // The newest runtime will be at the end of the list,
    // reversing the result would save time from try-error.
    return (await resp.json()).reverse().filter(pageIsSupported);
}
function pageIsSupported(app) {
    const capabilities = app.reactNative?.capabilities ?? {};
    return 'nativePageReloads' in capabilities && capabilities.nativePageReloads === true;
}
