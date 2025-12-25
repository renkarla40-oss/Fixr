import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';

export default function SplashScreen() {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Run both animations in parallel - logo zooms forward towards the screen
    Animated.parallel([
      // Scale from small to large - creates "coming at you" effect
      Animated.timing(scaleAnim, {
        toValue: 1.4,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Fade in quickly at the start
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate after animation completes
    const timer = setTimeout(() => {
      router.replace('/welcome');
    }, 1600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Image 
          source={require('../assets/images/fixr-logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 260,
    height: 130,
  },
});
