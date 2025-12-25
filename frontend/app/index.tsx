import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export default function SplashScreen() {
  const router = useRouter();
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    // Start the breathing animation with a slight delay for visibility
    const animationDelay = setTimeout(() => {
      // Animate scale from 0.85 to 1.08
      scale.value = withTiming(1.08, {
        duration: 1200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      
      // Animate opacity from 0.3 to 1
      opacity.value = withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.ease),
      });
    }, 100);

    // Navigate after animation completes
    const navigationTimer = setTimeout(() => {
      router.replace('/welcome');
    }, 1800);

    return () => {
      clearTimeout(animationDelay);
      clearTimeout(navigationTimer);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrapper, animatedStyle]}>
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
