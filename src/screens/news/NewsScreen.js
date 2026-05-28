import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';
import VoteScreen from '../vote/VoteScreen';
import NoticeScreen from '../notice/NoticeScreen';

const SECTIONS = [
  { key: 'votes', label: 'VOTE' },
  { key: 'notices', label: 'NOTICE' },
];

const NewsScreen = () => {
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState('votes');

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrap, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>NEWS</Text>
          </View>
          <View style={styles.headerDivider} />
          <Text style={styles.subtitle}>Votes and notices in one compact board</Text>

          <View style={styles.segmentRow}>
            {SECTIONS.map((section) => {
              const selected = activeSection === section.key;
              return (
                <TouchableOpacity
                  key={section.key}
                  style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                  activeOpacity={0.85}
                  onPress={() => setActiveSection(section.key)}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{section.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {activeSection === 'votes' ? <VoteScreen isIntegrated /> : <NoticeScreen isIntegrated />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DrawerTheme.bgBlackPurple,
  },
  headerWrap: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  header: {
    ...CommonStyles.headerBoard,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
    borderRadius: 10,
  },
  titleRow: {
    ...CommonStyles.titleRow,
    marginBottom: 2,
  },
  title: {
    ...CommonStyles.title,
    fontSize: 18,
    letterSpacing: 2.5,
  },
  headerDivider: {
    ...CommonStyles.headerDivider,
    width: 36,
    marginVertical: 6,
  },
  subtitle: {
    ...CommonStyles.subtitle,
    fontSize: 11,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  segmentButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: DrawerTheme.goldBrass,
    borderColor: DrawerTheme.goldBright,
  },
  segmentText: {
    color: DrawerTheme.woodLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  segmentTextActive: {
    color: DrawerTheme.bgBlackPurple,
  },
  content: {
    flex: 1,
  },
});

export default NewsScreen;
