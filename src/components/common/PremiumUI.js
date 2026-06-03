import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerTheme } from '../../constants/DrawerTheme';

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export const PremiumGradients = {
  screen: ['#070009', '#130014', '#24051F', '#100006'],
  panel: ['rgba(31,18,12,0.96)', 'rgba(18,0,8,0.96)'],
  card: ['rgba(30,10,21,0.88)', 'rgba(15,3,10,0.94)'],
  walnut: ['rgba(50,29,18,0.98)', 'rgba(24,10,6,0.98)'],
  gold: ['#C8A340', '#A77A2F', '#7A5522'],
  softGold: ['rgba(200,163,64,0.82)', 'rgba(167,122,47,0.76)', 'rgba(111,78,30,0.78)'],
  wine: ['#3B0B24', '#17000F'],
};

export const ScreenContainer = ({ children, style, contentStyle, safeTop = true, safeBottom = true }) => {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={PremiumGradients.screen} style={[styles.screen, style]}>
      <View pointerEvents="none" style={styles.goldGlow} />
      <View pointerEvents="none" style={styles.wineGlow} />
      <View
        style={[
          styles.content,
          safeTop && { paddingTop: insets.top },
          safeBottom && { paddingBottom: insets.bottom },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
};

export const PremiumHeaderPanel = ({ title, subtitle, children, compact = false, style }) => (
  <LinearGradient colors={PremiumGradients.panel} style={[styles.headerPanel, compact && styles.headerCompact, style]}>
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={styles.divider} />
    {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
    {children}
  </LinearGradient>
);

export const ArchiveTitleHeader = ({ eyebrow, title, subtitle, children, style, contentStyle }) => (
  <View style={[styles.archiveTitleWrap, style]}>
    <View style={styles.archiveFixedTitleBlock}>
      <Text style={styles.archiveEyebrow}>{eyebrow || ' '}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={styles.archiveTitle}
      >
        {title}
      </Text>
      <Text style={styles.archiveSubtitle}>{subtitle || ' '}</Text>
      <View style={styles.archiveOrnamentRow}>
        <View style={styles.archiveOrnamentLine} />
        <View style={styles.archiveOrnamentRing} />
        <View style={styles.archiveOrnamentLine} />
      </View>
    </View>
    {!!children && <View style={[styles.archiveHeaderContent, contentStyle]}>{children}</View>}
  </View>
);


export const PremiumCard = ({ children, variant = 'card', style, contentStyle }) => (
  <LinearGradient
    colors={variant === 'walnut' ? PremiumGradients.walnut : PremiumGradients.card}
    style={[styles.card, style]}
  >
    <View style={contentStyle}>{children}</View>
  </LinearGradient>
);

export const GoldActionButton = ({ title, children, onPress, disabled, style, textStyle, dark = false }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.86} style={[styles.buttonWrap, style]}>
    <LinearGradient
      colors={dark ? PremiumGradients.wine : PremiumGradients.gold}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.goldButton, disabled && styles.disabled]}
    >
      <Text style={[styles.goldButtonText, dark && styles.darkButtonText, textStyle]}>{children || title}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

export const SegmentControl = ({ options, value, onChange, style }) => (
  <View style={[styles.segment, style]} accessibilityRole="tablist">
    {options.map((option) => {
      const active = option.value === value || option.key === value;
      const optionValue = option.value ?? option.key;
      return (
        <TouchableOpacity
          key={optionValue}
          activeOpacity={0.85}
          onPress={() => onChange(optionValue)}
          style={[styles.segmentItem, active ? styles.segmentItemActive : styles.segmentItemInactive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
        >
          {active ? (
            <LinearGradient colors={PremiumGradients.softGold} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          ) : null}
          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export const CellarMark = ({ size = 14, filled = false, style }) => (
  <View
    style={[
      styles.cellarMark,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
      },
      filled && styles.cellarMarkFilled,
      style,
    ]}
  >
    <View style={[styles.cellarMarkInner, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 }]} />
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DrawerTheme.bgBlackPurple,
  },
  content: {
    flex: 1,
  },
  goldGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    right: -70,
    top: 42,
    borderRadius: 85,
    backgroundColor: 'rgba(200,163,64,0.08)',
  },
  wineGlow: {
    position: 'absolute',
    width: 250,
    height: 220,
    left: -90,
    bottom: 80,
    borderRadius: 130,
    backgroundColor: 'rgba(74,15,43,0.2)',
  },
  headerPanel: {
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.34)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  headerCompact: {
    paddingVertical: 16,
  },
  headerTitle: {
    color: DrawerTheme.brightGold,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: serif,
    letterSpacing: 3,
    textAlign: 'center',
  },
  divider: {
    width: 54,
    height: 1,
    backgroundColor: DrawerTheme.antiqueGold,
    opacity: 0.72,
    marginVertical: 10,
  },
  headerSubtitle: {
    color: DrawerTheme.ivory,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '500',
  },
  archiveTitleWrap: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 14,
  },
  archiveFixedTitleBlock: {
    width: '100%',
    height: 106,
    alignItems: 'center',
    position: 'relative',
  },
  archiveEyebrow: {
    position: 'absolute',
    top: 0,
    height: 14,
    includeFontPadding: false,
    color: DrawerTheme.mutedIvory,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 3.2,
    textAlign: 'center',
    opacity: 0.78,
  },
  archiveTitle: {
    position: 'absolute',
    top: 22,
    width: '100%',
    includeFontPadding: false,
    color: DrawerTheme.brightGold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    fontFamily: serif,
    letterSpacing: 3.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.86)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },
  archiveSubtitle: {
    position: 'absolute',
    top: 56,
    height: 18,
    includeFontPadding: false,
    color: DrawerTheme.ivory,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.1,
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  archiveOrnamentRow: {
    position: 'absolute',
    top: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56%',
  },
  archiveOrnamentLine: {
    flex: 1,
    height: 1,
    backgroundColor: DrawerTheme.antiqueGold,
    opacity: 0.68,
  },
  archiveOrnamentRing: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: DrawerTheme.antiqueGold,
    marginHorizontal: 10,
    opacity: 0.78,
    backgroundColor: 'rgba(9,0,13,0.22)',
  },
  archiveHeaderContent: {
    width: '100%',
    marginTop: 14,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(244,232,208,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  buttonWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  goldButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224,184,90,0.38)',
    paddingHorizontal: 18,
  },
  disabled: {
    opacity: 0.55,
  },
  goldButtonText: {
    color: DrawerTheme.bgBlackCherry,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  darkButtonText: {
    color: DrawerTheme.brightGold,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(184,135,53,0.28)',
    borderRadius: 999,
    padding: 4,
    backgroundColor: 'rgba(7,0,9,0.56)',
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentItemInactive: {
    backgroundColor: 'rgba(244,232,208,0.04)',
  },
  segmentItemActive: {
    borderWidth: 1,
    borderColor: 'rgba(224,184,90,0.42)',
  },
  segmentText: {
    color: DrawerTheme.ivory,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.92,
    zIndex: 1,
    elevation: 1,
  },
  segmentTextActive: {
    color: DrawerTheme.bgBlackCherry,
    opacity: 1,
  },
  cellarMark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.62)',
    backgroundColor: 'rgba(9,0,13,0.72)',
  },
  cellarMarkFilled: {
    backgroundColor: DrawerTheme.antiqueGold,
    borderColor: DrawerTheme.brightGold,
  },
  cellarMarkInner: {
    borderWidth: 1,
    borderColor: 'rgba(18,0,8,0.72)',
    backgroundColor: 'rgba(18,0,8,0.28)',
  },
});
