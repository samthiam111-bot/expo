import type { NativeStackHeaderItemButton } from '@react-navigation/native-stack';
import { Children, type ReactNode } from 'react';
import { type ColorValue, type ImageSourcePropType, type StyleProp } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { StackToolbarBadge, StackToolbarIcon, StackToolbarLabel } from './toolbar-primitives';
import { getFirstChildOfType } from '../../../utils/children';
import { convertTextStyleToRNTextStyle, type BasicTextStyle } from '../../../utils/font';

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

// We need to pick these properties, as the SharedHeaderItem is not exported by React Navigation
type RNSharedHeaderItem = Pick<
  NativeStackHeaderItemButton,
  | 'label'
  | 'labelStyle'
  | 'icon'
  | 'variant'
  | 'tintColor'
  | 'disabled'
  | 'width'
  | 'hidesSharedBackground'
  | 'sharesBackground'
  | 'identifier'
  | 'badge'
  | 'accessibilityLabel'
  | 'accessibilityHint'
>;

/**
 * Extracts xcasset name from icon component children or returns undefined.
 * Used by bottom toolbar components to pass xcassetName to native views.
 *
 * @internal
 */
export function extractXcassetName(props: StackHeaderItemSharedProps): string | undefined {
  // Icon child takes precedence
  const iconComponentProps = getFirstChildOfType(props.children, StackToolbarIcon)?.props;
  if (iconComponentProps && 'xcasset' in iconComponentProps) {
    return iconComponentProps.xcasset;
  }
  // Fall back to xcasset prop
  return props.xcasset;
}

/**
 * Extracts ImageSourcePropType from Icon child's `src` prop or from the `icon` prop (when non-string).
 * Returns the source and optional renderingMode from the Icon child.
 * Used by bottom toolbar components to pass imageSource to native views.
 *
 * @internal
 */
export function extractImageSource(
  props: StackHeaderItemSharedProps
): { source: ImageSourcePropType; renderingMode?: 'template' | 'original' } | undefined {
  // Icon child takes precedence
  const iconComponentProps = getFirstChildOfType(props.children, StackToolbarIcon)?.props;
  if (iconComponentProps && 'src' in iconComponentProps) {
    return {
      source: iconComponentProps.src,
      renderingMode:
        'renderingMode' in iconComponentProps ? iconComponentProps.renderingMode : undefined,
    };
  }
  // Fall back to icon prop when non-string
  if (props.icon && typeof props.icon !== 'string') {
    return { source: props.icon };
  }
  return undefined;
}

export function convertStackHeaderSharedPropsToRNSharedHeaderItem(
  props: StackHeaderItemSharedProps
): RNSharedHeaderItem {
  const { children, style, separateBackground, icon, xcasset, ...rest } = props;
  const stringChildren = Children.toArray(children)
    .filter((child) => typeof child === 'string')
    .join('');
  const label = getFirstChildOfType(children, StackToolbarLabel);
  const iconPropConvertedToIcon = props.xcasset
    ? { xcasset: props.xcasset }
    : props.icon
      ? typeof props.icon === 'string'
        ? { sf: props.icon }
        : { src: props.icon }
      : undefined;
  const iconComponentProps =
    getFirstChildOfType(children, StackToolbarIcon)?.props ?? iconPropConvertedToIcon;
  const badgeComponent = getFirstChildOfType(children, StackToolbarBadge);
  const rnsIcon: NativeStackHeaderItemButton['icon'] = (() => {
    if (!iconComponentProps) {
      return undefined;
    }
    if ('src' in iconComponentProps) {
      // Get explicit renderingMode from icon component props, or use iconRenderingMode from shared props
      const explicitRenderingMode =
        'renderingMode' in iconComponentProps ? iconComponentProps.renderingMode : undefined;
      const effectiveRenderingMode =
        explicitRenderingMode ??
        props.iconRenderingMode ??
        (props.tintColor ? 'template' : 'original');
      return {
        type: 'image',
        source: iconComponentProps.src,
        tinted: effectiveRenderingMode === 'template',
      };
    }
    if ('xcasset' in iconComponentProps) {
      // Type assertion needed: xcasset is supported by react-native-screens
      // but not yet typed in @react-navigation/native-stack's PlatformIconIOS
      return {
        type: 'xcasset',
        name: iconComponentProps.xcasset,
      } as unknown as NativeStackHeaderItemButton['icon'];
    }
    return {
      type: 'sfSymbol',
      name: iconComponentProps.sf,
    };
  })();
  const item: RNSharedHeaderItem = {
    ...rest,
    label: label?.props.children ?? stringChildren,
    sharesBackground: !separateBackground,
  };
  if (style) {
    const convertedStyle = convertTextStyleToRNTextStyle(style) ?? {};
    item.labelStyle = convertedStyle;
  }
  if (badgeComponent) {
    item.badge = {
      value: badgeComponent.props.children ?? '',
    };
    const badgeStyle = convertTextStyleToRNTextStyle(badgeComponent.props.style);
    if (badgeStyle) {
      item.badge.style = badgeStyle;
    }
  }
  if (rnsIcon) {
    item.icon = rnsIcon;
  }
  return item;
}
