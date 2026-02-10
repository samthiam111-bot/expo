"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouterToolbarItemWithImageSupport = RouterToolbarItemWithImageSupport;
const expo_image_1 = require("expo-image");
const native_1 = require("./native");
function RouterToolbarItemWithImageSupport(props) {
    const { xcassetName, imageSource, ...rest } = props;
    if (imageSource) {
        return <RouterToolbarItemWithResolvedImage {...rest} imageSource={imageSource}/>;
    }
    if (xcassetName) {
        return <RouterToolbarItemWithXcasset {...rest} xcassetName={xcassetName}/>;
    }
    return <native_1.RouterToolbarItem {...rest}/>;
}
function RouterToolbarItemWithResolvedImage(props) {
    const { imageSource, ...rest } = props;
    if (Array.isArray(imageSource)) {
        throw new Error('Array of image sources is currently not supported for toolbar icons');
    }
    const resolvedImage = (0, expo_image_1.useImage)(imageSource);
    return <native_1.RouterToolbarItem {...rest} image={rest.image ?? resolvedImage}/>;
}
function RouterToolbarItemWithXcasset(props) {
    const { xcassetName, ...rest } = props;
    const xcassetImage = (0, expo_image_1.useImage)({ uri: xcassetName }, {}, [xcassetName]);
    return <native_1.RouterToolbarItem {...rest} image={rest.image ?? xcassetImage}/>;
}
//# sourceMappingURL=RouterToolbarItemWithImageSupport.js.map