import { Color, Link, router, usePathname, type Href } from 'expo-router';
import { Toolbar } from 'expo-router/unstable-toolbar';
import React from 'react';
import { Text, Pressable, ScrollView, View, Image } from 'react-native';

import { featureFlags } from 'react-native-screens';
featureFlags.experiment.synchronousScreenUpdatesEnabled = true;

const HomeIndex = () => {
  const pathname = usePathname();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ alignItems: 'center', gap: 16 }}
      contentInsetAdjustmentBehavior="automatic">
      <Toolbar>
        <Toolbar.View separateBackground>
          <Image
            source={{ uri: 'https://github.com/evanbacon.png' }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        </Toolbar.View>
        <Toolbar.Button icon="pencil.tip.crop.circle" />
        <Toolbar.Button icon="pencil.and.outline" />
        {/* <Toolbar.Button icon="square.and.arrow.up" /> */}
        <Toolbar.Menu icon="ellipsis">
          <Toolbar.Menu palette inline>
            <Toolbar.MenuAction icon="icloud.and.arrow.up.fill" />
            <Toolbar.MenuAction icon="puzzlepiece.extension.fill" />
            <Toolbar.MenuAction icon="curlybraces" />
          </Toolbar.Menu>
          <Toolbar.Menu inline>
            <Toolbar.MenuAction icon="asterisk" subtitle="Opus 4.5">
              Claude Code
            </Toolbar.MenuAction>
          </Toolbar.Menu>
          <Toolbar.MenuAction icon="square.and.arrow.down">Download Source</Toolbar.MenuAction>
        </Toolbar.Menu>

        <Toolbar.Spacer />

        <Toolbar.Button
          separateBackground
          variant="prominent"
          icon="checkmark"
          onPress={() => {
            router.back();
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
