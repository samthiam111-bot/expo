import { Color, Link, router, usePathname, type Href } from 'expo-router';
import { Toolbar } from 'expo-router/unstable-toolbar';
import React from 'react';
import { Text, Pressable, ScrollView, View } from 'react-native';

const HomeIndex = () => {
  const pathname = usePathname();

  const [align, setAlign] = React.useState<'center' | 'justify' | 'left'>('center');
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Color.ios.secondarySystemBackground }}
      contentContainerStyle={{ alignItems: 'center', gap: 16 }}
      contentInsetAdjustmentBehavior="automatic">
      <Toolbar>
        <Toolbar.Button
          separateBackground
          icon={
            align === 'center'
              ? 'text.justify'
              : align === 'justify'
                ? 'text.alignleft'
                : 'text.aligncenter'
          }
          onPress={() => {
            setAlign((a) => (a === 'center' ? 'justify' : a === 'left' ? 'center' : 'left'));
          }}
        />
        {align === 'justify' && <Toolbar.Spacer />}
        <Toolbar.Button icon="ellipsis.message" />
        <Toolbar.Button icon="apps.iphone" />

        {['justify', 'left'].includes(align) && <Toolbar.Spacer />}

        <Toolbar.Button
          separateBackground
          icon="rectangle.portrait.bottomhalf.inset.filled"
          onPress={() => {
            router.push('/toolbar');
          }}
        />
      </Toolbar>
    </ScrollView>
  );
};

function CaseLink({ href, text }: { href: Href; text: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={{ backgroundColor: 'rgb(11, 103, 175)', padding: 16, borderRadius: 8 }}>
        <Text style={{ color: '#fff' }}>{text}</Text>
      </Pressable>
    </Link>
  );
}

export default HomeIndex;
