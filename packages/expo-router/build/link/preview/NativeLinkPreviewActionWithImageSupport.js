"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeLinkPreviewActionWithImageSupport = NativeLinkPreviewActionWithImageSupport;
const expo_image_1 = require("expo-image");
const native_1 = require("./native");
function NativeLinkPreviewActionWithImageSupport(props) {
    const { xcassetName, imageSource, ...rest } = props;
    if (imageSource) {
        return <NativeLinkPreviewActionWithResolvedImage {...rest} imageSource={imageSource}/>;
    }
    if (xcassetName) {
        return <NativeLinkPreviewActionWithXcasset {...rest} xcassetName={xcassetName}/>;
    }
    return <native_1.NativeLinkPreviewAction {...rest}/>;
}
function NativeLinkPreviewActionWithResolvedImage(props) {
    const { imageSource, ...rest } = props;
    const resolvedImage = (0, expo_image_1.useImage)(imageSource);
    return <native_1.NativeLinkPreviewAction {...rest} image={rest.image ?? resolvedImage}/>;
}
function NativeLinkPreviewActionWithXcasset(props) {
    const { xcassetName, ...rest } = props;
    const xcassetImage = (0, expo_image_1.useImage)({ uri: xcassetName }, {}, [xcassetName]);
    return <native_1.NativeLinkPreviewAction {...rest} image={rest.image ?? xcassetImage}/>;
}
//# sourceMappingURL=NativeLinkPreviewActionWithImageSupport.js.map