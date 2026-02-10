'use client';

import { useImage } from 'expo-image';
import type { ImageSourcePropType } from 'react-native';

import { RouterToolbarItem } from './native';
import type { RouterToolbarItemProps } from './native.types';

export function RouterToolbarItemWithImageSupport(
  props: RouterToolbarItemProps & { xcassetName?: string; imageSource?: ImageSourcePropType }
) {
  const { xcassetName, imageSource, ...rest } = props;
  if (imageSource) {
    return <RouterToolbarItemWithResolvedImage {...rest} imageSource={imageSource} />;
  }
  if (xcassetName) {
    return <RouterToolbarItemWithXcasset {...rest} xcassetName={xcassetName} />;
  }
  return <RouterToolbarItem {...rest} />;
}

function RouterToolbarItemWithResolvedImage(
  props: RouterToolbarItemProps & { imageSource: ImageSourcePropType }
) {
  const { imageSource, ...rest } = props;
  if (Array.isArray(imageSource)) {
    throw new Error('Array of image sources is currently not supported for toolbar icons');
  }
  const resolvedImage = useImage(imageSource);
  return <RouterToolbarItem {...rest} image={rest.image ?? resolvedImage} />;
}

function RouterToolbarItemWithXcasset(props: RouterToolbarItemProps & { xcassetName: string }) {
  const { xcassetName, ...rest } = props;
  const xcassetImage = useImage({ uri: xcassetName }, {}, [xcassetName]);
  return <RouterToolbarItem {...rest} image={rest.image ?? xcassetImage} />;
}
