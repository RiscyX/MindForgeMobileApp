import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

export default function AppBackground({ children }) {
  return (
    <View style={styles.container}>
      <View style={styles.backgroundContainer}>
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <RadialGradient
              id="grad1"
              cx="15%"
              cy="35%"
              rx="900"
              ry="900"
              fx="15%"
              fy="35%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#575ddb" stopOpacity="0.16" />
              <Stop offset="0.55" stopColor="#575ddb" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient
              id="grad2"
              cx="85%"
              cy="65%"
              rx="900"
              ry="900"
              fx="85%"
              fy="65%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#5b5b6b" stopOpacity="0.14" />
              <Stop offset="0.6" stopColor="#5b5b6b" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          
          {/* Base Background */}
          <Rect x="0" y="0" width="100%" height="100%" fill="#010104" />
          
          {/* Gradients */}
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad1)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad2)" />
        </Svg>
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010104',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
