import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumHeaderPanel, ScreenContainer, SegmentControl } from '../../components';
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
    <ScreenContainer safeTop={false} safeBottom={false}>
      <View style={[styles.headerWrap, { paddingTop: insets.top + 12 }]}>
        <PremiumHeaderPanel title="NEWS" subtitle="셀러의 의식과 공지를 한 보드에서 확인하세요" compact>
          <SegmentControl
            options={SECTIONS}
            value={activeSection}
            onChange={setActiveSection}
            style={styles.segmentRow}
          />
        </PremiumHeaderPanel>
      </View>

      <View style={styles.content}>
        {activeSection === 'votes' ? <VoteScreen isIntegrated /> : <NoticeScreen isIntegrated />}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  segmentRow: {
    marginTop: 12,
    width: '100%',
  },
  content: {
    flex: 1,
  },
});

export default NewsScreen;
