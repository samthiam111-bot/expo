import { optionalRequire } from '../../navigation/routeBuilder';
import ComponentListScreen, { componentScreensToListElements } from '../ComponentListScreen';

export const SearchBarScreens = [
  {
    name: 'Full Screen SearchBar',
    route: 'ui/searchbar/fullscreen',
    options: { headerShown: false },
    getComponent() {
      return optionalRequire(() => require('./SearchBarFullScreenScreen'));
    },
  },
];

export default function SearchBarScreen() {
  const apis = componentScreensToListElements(SearchBarScreens);
  return <ComponentListScreen apis={apis} />;
}

SearchBarScreen.navigationOptions = {
  title: 'SearchBar',
};
