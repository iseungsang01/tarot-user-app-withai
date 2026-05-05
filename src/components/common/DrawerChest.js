import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerTheme } from '../../constants/DrawerTheme';

export const DrawerChest = ({ children, isManualMode }) => {
  const sideTint = isManualMode ? 'rgba(42,6,44,0.7)' : 'rgba(31,18,12,0.82)';

  return (
    <View style={styles.chestContainer}>
      <View style={styles.backLip} />
      <LinearGradient
        colors={['#120806', DrawerTheme.walnutLight, DrawerTheme.walnutDark, DrawerTheme.walnutLight, '#120806']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topMolding}
      />
      <LinearGradient
        colors={['#120A06', DrawerTheme.walnutLight, '#120A06']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topSubMolding}
      />

      <LinearGradient
        colors={[sideTint, DrawerTheme.walnutDark, sideTint]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.mainBody}
      >
        <View style={styles.sideRailLeft} />
        <View style={styles.sideRailRight} />
        <View style={styles.drawerContent}>{children}</View>
      </LinearGradient>

      <LinearGradient
        colors={['#120A06', DrawerTheme.walnutLight, '#120A06']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bottomMolding}
      />
      <View style={styles.legsRow}>
        <View style={styles.leg} />
        <View style={styles.leg} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chestContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  },
  backLip: {
    width: '100%',
    height: 8,
    backgroundColor: '#1A0E08',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(224,184,90,0.24)',
  },
  topMolding: {
    width: '100%',
    height: 11,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderTopWidth: 1,
    borderColor: 'rgba(224,184,90,0.34)',
  },
  topSubMolding: {
    width: '100%',
    height: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.62)',
  },
  mainBody: {
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderColor: 'rgba(12,6,4,0.92)',
    overflow: 'hidden',
  },
  sideRailLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 4,
    width: 2,
    backgroundColor: 'rgba(224,184,90,0.22)',
  },
  sideRailRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 4,
    width: 2,
    backgroundColor: 'rgba(224,184,90,0.22)',
  },
  drawerContent: {
    paddingTop: 6,
    paddingBottom: 7,
    paddingHorizontal: 3,
  },
  bottomMolding: {
    width: '100%',
    height: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopWidth: 1,
    borderColor: 'rgba(224,184,90,0.22)',
  },
  legsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 34,
    marginTop: -2,
  },
  leg: {
    width: 22,
    height: 18,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: DrawerTheme.walnutDark,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(224,184,90,0.2)',
  },
});
