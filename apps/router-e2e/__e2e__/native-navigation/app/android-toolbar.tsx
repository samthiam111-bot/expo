import { Host, HorizontalFloatingToolbar, IconButton, Icon } from '@expo/ui/jetpack-compose';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View, StyleSheet, Pressable } from 'react-native';

const ITEMS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  title: `Item ${i + 1}`,
  subtitle: `Tap to interact with item ${i + 1}`,
}));

export default function AndroidToolbarScreen() {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const toggleItem = (id: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Android Toolbar' }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          contentInsetAdjustmentBehavior="automatic">
          {ITEMS.map((item) => {
            const selected = selectedItems.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleItem(item.id)}
                style={[styles.item, selected && styles.itemSelected]}>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, selected && styles.itemTitleSelected]}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                </View>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            );
          })}
        </ScrollView>

        <Host matchContents style={styles.toolbar}>
          <HorizontalFloatingToolbar>
            <IconButton onPress={() => setSelectedItems(new Set())}>
              <Icon
                source={require('../assets/icons/expo-logo.png')}
                contentDescription="Clear selection"
              />
            </IconButton>
            <IconButton onPress={() => setSelectedItems(new Set(ITEMS.map((i) => i.id)))}>
              <Icon
                source={require('../assets/icons/search.xml')}
                contentDescription="Select all"
              />
            </IconButton>
            <IconButton onPress={() => setSelectedItems(new Set())}>
              <Icon source={require('../assets/icons/delete.xml')} contentDescription="Delete" />
            </IconButton>
            <HorizontalFloatingToolbar.FloatingActionButton
              onPress={() => setSelectedItems(new Set())}>
              <Icon source={require('../assets/icons/add.xml')} contentDescription="Add" />
            </HorizontalFloatingToolbar.FloatingActionButton>
          </HorizontalFloatingToolbar>
        </Host>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  itemSelected: {
    backgroundColor: '#e0e7ff',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  itemTitleSelected: {
    color: '#3b52c4',
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: '#3b52c4',
    fontWeight: 'bold',
  },
  toolbar: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
});
