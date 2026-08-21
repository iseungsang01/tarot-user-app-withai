import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { DrawerMark, LoadingSpinner, NoticeCard, PremiumCard } from '../../../components';
import { useAuth } from '../../../hooks/useAuth';
import { notifyNoticesRead } from '../../../hooks/useNotifications';
import { noticeService } from '../../../services/noticeService';
import { DrawerTheme } from '../../../constants/DrawerTheme';

const NoticePanel = () => {
  const navigation = useNavigation();
  const { customer } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const { data, error } = await noticeService.getNotices();
      if (!error) setNotices(data);
      if (customer) {
        await noticeService.markAllNoticesAsRead();
        // 탭바의 빨간 점도 같이 꺼야 한다.
        notifyNoticesRead();
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [customer])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <FlatList
        data={notices}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NoticeCard notice={item} onPress={(notice) => navigation.navigate('NoticeDetail', { notice })} />
        )}
        ListEmptyComponent={
          <PremiumCard style={styles.emptyBox} contentStyle={styles.emptyContent}>
            <View style={styles.boardIllustration}>
              <View style={styles.boardFrame}>
                <View style={styles.boardLine} />
                <DrawerMark size={24} filled style={styles.boardSeal} />
                <View style={[styles.boardLine, styles.boardLineShort]} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>등록된 공지가 없습니다</Text>
            <Text style={styles.emptySupport}>새로운 공지가 올라오면 이곳에서 확인할 수 있습니다.</Text>
          </PremiumCard>
        }
        contentContainerStyle={styles.listArea}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={DrawerTheme.goldBrass}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listArea: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  emptyBox: {
    padding: 16,
  },
  emptyContent: {
    width: '100%',
    minHeight: 176,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.28)',
    backgroundColor: 'rgba(31,18,12,0.46)',
    overflow: 'hidden',
    gap: 8,
  },
  boardIllustration: {
    width: 78,
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.16)',
    backgroundColor: 'rgba(9,0,13,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  boardFrame: {
    width: 54,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  boardLine: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(244,232,208,0.22)',
  },
  boardLineShort: {
    width: 18,
  },
  boardSeal: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  emptyTitle: {
    width: '100%',
    fontSize: 15,
    color: DrawerTheme.ivory,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySupport: {
    width: '86%',
    fontSize: 12,
    lineHeight: 18,
    color: DrawerTheme.mutedIvory,
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.82,
  },
});

export default NoticePanel;
