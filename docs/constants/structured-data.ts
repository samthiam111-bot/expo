export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Expo Documentation',
  url: 'https://docs.expo.dev',
  publisher: {
    '@type': 'Organization',
    name: 'Expo',
    url: 'https://expo.dev',
    logo: {
      '@type': 'ImageObject',
      url: 'https://raw.githubusercontent.com/expo/logos/main/png/logo-type-a.png',
    },
    sameAs: [
      'https://github.com/expo',
      'https://x.com/expo',
      'https://bsky.app/profile/expo.dev',
      'https://www.linkedin.com/company/expo-dev/',
      'https://www.youtube.com/@expodevelopers',
    ],
  },
};
