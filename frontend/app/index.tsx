import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Logo sizing: 85% of screen width at rest (scale 1.0)
const LOGO_WIDTH = SCREEN_WIDTH * 0.85;
const LOGO_HEIGHT = LOGO_WIDTH * 0.5; // Maintain aspect ratio

/**
 * Splash Screen - Bold Forward-Motion Animation
 * 
 * 4-PHASE ANIMATION:
 * Phase 1: APPEAR - Logo appears at scale 0.85, centered (200ms)
 * Phase 2: MOVE FORWARD - Scale 0.85 → 1.35, feels like coming toward viewer (600-700ms)
 * Phase 3: SETTLE BACK - Scale 1.35 → 1.0, settles to final position (400-500ms)
 * Phase 4: HOLD - Hold final position (500-700ms), then navigate
 */
export default function SplashScreen() {
  const router = useRouter();
  const { loading } = useAuth();
  
  // Animation value - controls scale
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const animationComplete = useRef(false);
  const hasNavigated = useRef(false);

  // Run 4-phase animation sequence
  useEffect(() => {
    // PHASE 1: APPEAR (200ms) - Start at 0.85, just establish presence
    const phase1Duration = 200;
    
    // PHASE 2: MOVE FORWARD (650ms) - Scale from 0.85 to 1.35
    const phase2Duration = 650;
    
    // PHASE 3: SETTLE BACK (450ms) - Scale from 1.35 to 1.0
    const phase3Duration = 450;
    
    // PHASE 4: HOLD (600ms) - No motion, just hold
    const phase4Duration = 600;

    // Phase 1: Hold at initial scale (0.85) for 200ms
    const phase1Timer = setTimeout(() => {
      // Phase 2: Move FORWARD - scale UP to 1.35 (coming toward viewer)
      Animated.timing(scaleAnim, {
        toValue: 1.35,
        duration: phase2Duration,
        easing: Easing.out(Easing.cubic), // Strong ease-out
        useNativeDriver: true,
      }).start(() => {
        // Phase 3: Settle BACK to 1.0
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: phase3Duration,
          easing: Easing.inOut(Easing.cubic), // Smooth ease-in-out
          useNativeDriver: true,
        }).start(() => {
          // Phase 4: HOLD - mark animation complete after hold duration
          setTimeout(() => {
            animationComplete.current = true;
          }, phase4Duration);
        });
      });
    }, phase1Duration);

    return () => clearTimeout(phase1Timer);
  }, []);

  // Navigate when BOTH animation is complete AND auth loading is done
  useEffect(() => {
    const checkAndNavigate = () => {
      if (!loading && animationComplete.current && !hasNavigated.current) {
        hasNavigated.current = true;
        // Direct transition to welcome screen - no fade
        router.replace('/welcome');
      }
    };

    // Check immediately
    checkAndNavigate();

    // Check periodically
    const interval = setInterval(checkAndNavigate, 50);

    return () => clearInterval(interval);
  }, [loading]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [{ scale: scaleAnim }],
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
    backgroundColor: '#000000', // Pure black background
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    // NO padding, NO margin - logo dominates
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    // NO additional constraints
  },
});
