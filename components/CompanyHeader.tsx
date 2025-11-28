import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

type Props = {
  title?: string; // optional if you want to show screen-specific title later
};

export default function CompanyHeader({ title }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')} // <-- replace with your actual logo path
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.text}>Maharlikan AssuredLife</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0d3b7a', // dark blue, professional
    letterSpacing: 0.5,
  },
});
