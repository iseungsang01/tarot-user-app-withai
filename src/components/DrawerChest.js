import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';

/**
 * 서랍장 틀 컴포넌트
 * @param {boolean} isManualMode - 현재 개인 메모(OFF) 모드인지 여부
 */
export const DrawerChest = ({ children, isManualMode }) => {
  // 모드에 따른 색상 결정
  const frameColor = isManualMode ? DrawerTheme.navyLight : DrawerTheme.woodFrame;
  const bodyColor = isManualMode ? '#10171E' : DrawerTheme.woodDark;

  return (
    <View style={styles.chestContainer}>
      {/* 가구 상판 몰딩 */}
      <View style={[styles.topMolding, { backgroundColor: frameColor }]} />
      <View style={[styles.topSubMolding, { backgroundColor: bodyColor }]} />

      <View style={[
        styles.mainBody, 
        { borderColor: frameColor, backgroundColor: bodyColor }
      ]}>
        {/* 서랍들이 쌓이는 중심부 */}
        <View style={[styles.drawerContent, { backgroundColor: bodyColor }]}>
          {children}
        </View>
      </View>

      {/* 가구 하단 받침 */}
      <View style={[styles.bottomMolding, { backgroundColor: frameColor }]} />
      <View style={styles.legsRow}>
        <View style={[styles.leg, { backgroundColor: frameColor }]} />
        <View style={[styles.leg, { backgroundColor: frameColor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chestContainer: { 
    width: '96%', 
    alignSelf: 'center', 
    marginVertical: 10 
  },
  topMolding: { 
    width: '106%', 
    height: 10, 
    alignSelf: 'center', 
    borderTopLeftRadius: 8, 
    borderTopRightRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3
  },
  topSubMolding: { 
    width: '102%', 
    height: 8, 
    alignSelf: 'center' 
  },
  mainBody: { 
    borderLeftWidth: 10, 
    borderRightWidth: 10,
  },
  drawerContent: { 
    paddingTop: 5,
    paddingBottom: 10
  },
  bottomMolding: { 
    width: '104%', 
    height: 12, 
    alignSelf: 'center', 
    borderBottomLeftRadius: 6, 
    borderBottomRightRadius: 6 
  },
  legsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 40, 
    marginTop: -2 
  },
  leg: { 
    width: 22, 
    height: 20, 
    borderBottomLeftRadius: 10, 
    borderBottomRightRadius: 10 
  },
});