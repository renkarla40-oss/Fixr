import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Easing, Dimensions } from 
'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LOGO_WIDTH = SCREEN_WIDTH * 0.72;
const LOGO_HEIGHT = LOGO_WIDTH * 0.5;

/**
 * Splash Screen — Spin & Settle Animation
 *
 * Phase 1: Fade in at scale 0.7 (120ms)
 * Phase 2: Spin 360° + scale up to 1.12 (700ms, ease-out)
 * Phase 3: Settle to scale 1.0 (380ms, ease-in-out)
 * Phase 4: Hold 600ms → navigate
 */
export default function SplashScreen() {
  const router = useRouter();
  const { loading } = useAuth();

  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const animationComplete = useRef(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      Animated.parallel([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 380,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start(() => {
          setTimeout(() => {
            animationComplete.current = true;
          }, 600);
        });
      });
    });
  }, []);

  useEffect(() => {
    const checkAndNavigate = () => {
      if (!loading && animationComplete.current && !hasNavigated.current) 
{
        hasNavigated.current = true;
        router.replace('/welcome');
      }
    };

    checkAndNavigate();
    const interval = setInterval(checkAndNavigate, 50);
    return () => clearInterval(interval);
  }, [loading]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: opacityAnim,
            transform: [
              { rotate: spin },
              { scale: scaleAnim },
            ],
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
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
