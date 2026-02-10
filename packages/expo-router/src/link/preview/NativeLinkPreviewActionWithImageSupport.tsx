'use client';

import { useImage, type ImageSource } from 'expo-image';
import type { ImageSourcePropType } from 'react-native';

import { NativeLinkPreviewAction, type NativeLinkPreviewActionProps } from './native';

export function NativeLinkPreviewActionWithImageSupport(
  props: NativeLinkPreviewActionProps & {
    xcassetName?: string;
    imageSource?: ImageSourcePropType;
  }
) {
  const { xcassetName, imageSource, ...rest } = props;
  if (imageSource) {
    return <NativeLinkPreviewActionWithResolvedImage {...rest} imageSource={imageSource} />;
  }
  if (xcassetName) {
    return <NativeLinkPreviewActionWithXcasset {...rest} xcassetName={xcassetName} />;
  }
  return <NativeLinkPreviewAction {...rest} />;
}

function NativeLinkPreviewActionWithResolvedImage(
  props: NativeLinkPreviewActionProps & { imageSource: ImageSourcePropType }
) {
  const { imageSource, ...rest } = props;
  const resolvedImage = useImage(imageSource as ImageSource | number);
  return <NativeLinkPreviewAction {...rest} image={rest.image ?? resolvedImage} />;
}

function NativeLinkPreviewActionWithXcasset(
  props: NativeLinkPreviewActionProps & { xcassetName: string }
) {
  const { xcassetName, ...rest } = props;
  const xcassetImage = useImage({ uri: xcassetName }, {}, [xcassetName]);
  return <NativeLinkPreviewAction {...rest} image={rest.image ?? xcassetImage} />;
}
