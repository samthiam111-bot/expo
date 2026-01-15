"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendMessageError = void 0;
class SendMessageError extends Error {
    app;
    constructor(message, app) {
        super(message);
        this.app = app;
    }
}
exports.SendMessageError = SendMessageError;
