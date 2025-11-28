import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

type Props = {
  title?: string;
};

export default function BrandHeader({ title = 'Maharlikan AssuredLife' }: Props) {
  return (
    <View style={styles.row}>
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.name}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  logo: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
