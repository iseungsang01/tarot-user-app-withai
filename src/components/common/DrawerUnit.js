import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LocalSvg } from 'react-native-svg/css';
import { DrawerTheme } from '../../constants/DrawerTheme';

const brassHandleAsset = require('../../../assets/tarot-cellar/brass-handle-b.svg');

export const DrawerUnit = React.memo(({ visit, onSelectCard, onLongPress, selectionMode, isSelected }) => {
  const isPlaceholder = visit.isPlaceholder === true;
  const isManualMode = visit.is_manual === true;
  const isOnMode = !isManualMode;
  const isWritten = !!(visit.card_review && visit.card_review.trim()) || !!visit.card_image;
  const title = visit.title
    || visit.drawer_title
    || (visit.card_review?.trim()?.split('\n')[0] || '').slice(0, 28)
    || (isManualMode ? 'Private note' : 'Unread record');
  const displayDate = visit.visit_date
    ? visit.visit_date.split('T')[0].split('-').join(' · ')
    : '';
  const status = isPlaceholder || isWritten ? 'SEALED' : isManualMode ? 'PRIVATE' : 'EMPTY';

  return (
    <View style={styles.drawerWrapper}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onSelectCard(visit)}
        onLongPress={onLongPress}
        delayLongPress={500}
        style={[
          styles.drawer,
          (isOnMode && !isWritten && !isPlaceholder) && styles.unwrittenDrawer,
          isSelected && styles.selectedDrawer
        ]}
      >
        <ImageBackground
          source={require('../../../assets/tarot-cellar/drawer-walnut.png')}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          imageStyle={styles.drawerTexture}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.28)']}
            locations={[0, 0.52, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.34)', 'transparent', 'transparent', 'rgba(0,0,0,0.34)']}
            locations={[0, 0.18, 0.82, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>

        <View style={styles.drawerInnerFrame}>
          {selectionMode && (
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
          )}

          <View style={styles.drawerMainRow}>
            <View style={styles.drawerLeft}>
              <View style={styles.sealedPlaque}>
                <Text numberOfLines={1} style={styles.sealedText}>{status}</Text>
              </View>
            </View>

            <View style={styles.drawerCenter}>
              <LocalSvg
                asset={brassHandleAsset}
                style={styles.brassHandle}
                width={92}
                height={34}
              />
            </View>

            <View style={styles.drawerRight}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.drawerDate}>
                {displayDate}
              </Text>
            </View>
          </View>

          {!isPlaceholder && (
            <View style={styles.drawerMetaRow}>
              <Text numberOfLines={1} style={styles.drawerTitle}>{title}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
});

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const styles = StyleSheet.create({
  drawerWrapper: {
    width: '100%',
    marginBottom: 9,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(5,2,1,0.92)',
  },
  drawer: {
    width: '100%',
    height: 118,
    borderRadius: 6,
    padding: 9,
    borderTopWidth: 1,
    borderBottomWidth: 4,
    borderTopColor: 'rgba(200,163,64,0.28)',
    borderBottomColor: 'rgba(0,0,0,0.66)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 6,
  },
  drawerTexture: {
    opacity: 0.95,
  },
  unwrittenDrawer: {
    opacity: 0.78,
  },
  selectedDrawer: {
    borderWidth: 2,
    borderColor: DrawerTheme.brassHighlight,
    shadowColor: DrawerTheme.brassHighlight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 7,
  },
  drawerInnerFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.58)',
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  drawerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    minWidth: 0,
  },
  drawerLeft: {
    width: 92,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  drawerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerRight: {
    width: 118,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sealedPlaque: {
    maxWidth: 82,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(224,184,90,0.72)',
    backgroundColor: 'rgba(31,18,12,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealedText: {
    color: DrawerTheme.brightGold,
    fontSize: 11,
    fontFamily: serif,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  brassHandle: {
    width: 92,
    height: 34,
    opacity: 0.96,
  },
  drawerDate: {
    color: DrawerTheme.brightGold,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    fontFamily: serif,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.72)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  drawerMetaRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,163,64,0.18)',
  },
  drawerTitle: {
    color: 'rgba(244,232,208,0.78)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkboxContainer: {
    position: 'absolute',
    top: 5,
    left: 5,
    zIndex: 3,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(224,184,90,0.45)',
    backgroundColor: 'rgba(9,0,13,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: DrawerTheme.brassHighlight,
    backgroundColor: DrawerTheme.brass,
  },
  checkmark: {
    fontSize: 14,
    color: DrawerTheme.bgBlackCherry,
    fontWeight: '900',
  },
});
