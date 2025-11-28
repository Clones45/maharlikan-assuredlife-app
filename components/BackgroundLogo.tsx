import React, { ReactNode } from 'react';
import { Image, StyleSheet, View, StyleSheet as RNStyleSheet } from 'react-native';

type Props = { children?: ReactNode };

/**
 * Works both as:
 *   <BackgroundLogo />                      // self-closing
 *   <BackgroundLogo>{/* content *\/}</BackgroundLogo>  // wrapper
 */
export default function BackgroundLogo({ children }: Props) {
  // Absolute background layer (never affects layout)
  const BgLayer = (
    <View pointerEvents="none" style={styles.layer}>
      <Image
        source={require('../assets/logo.png')}
        style={styles.bg}
        resizeMode="contain"
      />
    </View>
  );

  // If children are provided, render them normally on top of the background
  if (children) {
    return (
      <>
        {BgLayer}
        {children}
      </>
    );
  }

  // Self-closing usage renders just the background
  return BgLayer;
}

const styles = StyleSheet.create({
  // Absolutely fill the screen; no solid background color
  layer: {
    ...RNStyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Big, faint watermark
  bg: {
    width: '80%',
    height: '80%',
    opacity: 0.06,
  },
});
