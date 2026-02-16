import { SearchBar, Host } from '@expo/ui/jetpack-compose';
import { offset } from '@expo/ui/jetpack-compose/modifiers';
import * as React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

const ITEMS = [
  { name: 'Apple', subtitle: 'Sweet and crispy', id: 1 },
  { name: 'Banana', subtitle: 'Rich in potassium', id: 2 },
  { name: 'Cherry', subtitle: 'Small and tart', id: 3 },
  { name: 'Date', subtitle: 'Naturally sweet', id: 4 },
  { name: 'Elderberry', subtitle: 'Deep purple berry', id: 5 },
  { name: 'Fig', subtitle: 'Soft and jammy', id: 6 },
  { name: 'Grape', subtitle: 'Juicy clusters', id: 7 },
  { name: 'Honeydew', subtitle: 'Cool and refreshing', id: 8 },
  { name: 'Kiwi', subtitle: 'Tangy and green', id: 9 },
  { name: 'Lemon', subtitle: 'Sour and zesty', id: 10 },
  { name: 'Mango', subtitle: 'Tropical favorite', id: 11 },
  { name: 'Nectarine', subtitle: 'Smooth peach cousin', id: 12 },
  { name: 'Orange', subtitle: 'Classic citrus', id: 13 },
  { name: 'Papaya', subtitle: 'Exotic and creamy', id: 14 },
  { name: 'Raspberry', subtitle: 'Delicate and sweet', id: 15 },
  { name: 'Strawberry', subtitle: 'Summer classic', id: 16 },
  { name: 'Tangerine', subtitle: 'Easy to peel', id: 17 },
  { name: 'Watermelon', subtitle: 'Hydrating and sweet', id: 18 },
];

export default function SearchBarFullScreenScreen() {
  const [query, setQuery] = React.useState('');

  const filteredItems = React.useMemo(() => {
    if (!query) return ITEMS;
    const lowerQuery = query.toLowerCase();
    return ITEMS.filter((item) => item.name.toLowerCase().includes(lowerQuery));
  }, [query]);

  return (
    <View style={styles.container}>
      <Host style={styles.host}>
        <SearchBar
          defaultValue=""
          placeholder="Search fruits..."
          onChangeText={setQuery}
          onExpandedChange={(expanded) => {
            console.log(`SearchBar ${expanded ? 'expanded' : 'collapsed'}`);
          }}>
          <ScrollView>
            {filteredItems.map((item) => (
              <View key={item.name} style={styles.item}>
                <Image
                  source={{ uri: `https://picsum.photos/seed/${item.id}/100/100` }}
                  style={styles.avatar}
                />
                <View style={styles.textContainer}>
                  <Text style={styles.itemText}>{item.name}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
            {filteredItems.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No results found</Text>
              </View>
            )}
          </ScrollView>
        </SearchBar>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  host: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});
