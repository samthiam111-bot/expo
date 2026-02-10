import type { NativeStackHeaderItemButton } from '@react-navigation/native-stack';
import { type ReactNode } from 'react';
import { type ColorValue, type ImageSourcePropType, type StyleProp } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';
import { type BasicTextStyle } from '../../../utils/font';
export interface StackHeaderItemSharedProps {
    children?: ReactNode;
    style?: StyleProp<BasicTextStyle>;
    hidesSharedBackground?: boolean;
    separateBackground?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    disabled?: boolean;
    tintColor?: ColorValue;
    icon?: SFSymbol | ImageSourcePropType;
    /**
     * Name of an image in your Xcode asset catalog (`.xcassets`).
     *
     * The rendering mode is controlled by the asset catalog's "Render As" setting.
     *
     * @platform ios
     */
    xcasset?: string;
    /**
     * Controls how image-based icons are rendered on iOS.
     *
     * - `'template'`: iOS applies tint color to the icon
     * - `'original'`: Preserves original icon colors (useful for multi-color icons)
     *
     * **Default behavior:**
     * - If `tintColor` is specified, defaults to `'template'`
     * - If no `tintColor`, defaults to `'original'`
     *
     * This prop only affects image-based icons (not SF Symbols).
     *
     * @see [Apple documentation](https://developer.apple.com/documentation/uikit/uiimage/renderingmode-swift.enum) for more information.
     *
     * @platform ios
     */
    iconRenderingMode?: 'template' | 'original';
    /**
     * @default 'plain'
     */
    variant?: 'plain' | 'done' | 'prominent';
}
type RNSharedHeaderItem = Pick<NativeStackHeaderItemButton, 'label' | 'labelStyle' | 'icon' | 'variant' | 'tintColor' | 'disabled' | 'width' | 'hidesSharedBackground' | 'sharesBackground' | 'identifier' | 'badge' | 'accessibilityLabel' | 'accessibilityHint'>;
/**
 * Extracts xcasset name from icon component children or returns undefined.
 * Used by bottom toolbar components to pass xcassetName to native views.
 *
 * @internal
 */
export declare function extractXcassetName(props: StackHeaderItemSharedProps): string | undefined;
/**
 * Extracts ImageSourcePropType from Icon child's `src` prop or from the `icon` prop (when non-string).
 * Returns the source and optional renderingMode from the Icon child.
 * Used by bottom toolbar components to pass imageSource to native views.
 *
 * @internal
 */
export declare function extractImageSource(props: StackHeaderItemSharedProps): {
    source: ImageSourcePropType;
    renderingMode?: 'template' | 'original';
} | undefined;
export declare function convertStackHeaderSharedPropsToRNSharedHeaderItem(props: StackHeaderItemSharedProps): RNSharedHeaderItem;
export {};
//# sourceMappingURL=shared.d.ts.map