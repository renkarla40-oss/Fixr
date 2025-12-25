import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

export default function SplashScreen() {
  const router = useRouter();
  const scale = useSharedValue(0.9);

  const navigateToWelcome = () => {
    router.replace('/welcome');
  };

  useEffect(() => {
    // Start the breathing animation
    scale.value = withSequence(
      // Start at 0.9, animate to 1.05 over 1 second
      withTiming(1.05, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      })
    );

    // Navigate after animation completes (1s animation + 0.5s hold)
    const timer = setTimeout(() => {
      navigateToWelcome();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={animatedStyle}>
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
  logo: {
    width: 260,
    height: 130,
  },
});
