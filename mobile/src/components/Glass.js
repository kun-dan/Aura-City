// Liquid Glass surfaces.
// iOS 26+: Apple's native Liquid Glass (expo-glass-effect).
// Older iOS and web: system blur material. Android: tinted translucent glass with a specular sheen.
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, radius as R } from '../theme';

let liquid = false;
try {
  liquid = Platform.OS === 'ios' && isLiquidGlassAvailable();
} catch {
  liquid = false;
}
export const hasLiquidGlass = liquid;

const withAlpha = (hex, a) => {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
};

export function Glass({ children, style, tint, interactive = false, radius = R.md, clear = false, ...rest }) {
  const shape = { borderRadius: radius, borderCurve: 'continuous' };
  if (liquid) {
    return (
      <GlassView
        glassEffectStyle={clear ? 'clear' : 'regular'}
        tintColor={tint ? withAlpha(tint, 0.45) : undefined}
        isInteractive={interactive}
        colorScheme="dark"
        style={[shape, styles.clip, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  const blur = Platform.OS !== 'android';
  return (
    <View
      style={[
        shape,
        styles.clip,
        styles.fallback,
        { backgroundColor: tint ? withAlpha(tint, blur ? 0.32 : 0.7) : blur ? 'rgba(255,255,255,0.06)' : 'rgba(26,32,64,0.72)' },
        style,
      ]}
      {...rest}
    >
      {blur && <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.10)']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/** Groups glass shapes so they blend into each other on iOS 26. */
export function GlassGroup({ children, spacing = 10, style }) {
  if (liquid) return <GlassContainer spacing={spacing} style={style}>{children}</GlassContainer>;
  return <View style={style}>{children}</View>;
}

export function GlassPressable({ onPress, children, style, tint, radius, disabled, haptic = true, contentStyle, clear }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed && !liquid ? 0.97 : 1 }] }, style]}
    >
      <Glass interactive tint={tint} radius={radius} clear={clear} style={contentStyle}>
        {children}
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  fallback: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.hairline,
    borderTopColor: 'rgba(255,255,255,0.38)',
    borderLeftColor: 'rgba(255,255,255,0.28)',
  },
});
