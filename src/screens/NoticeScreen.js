import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GradientBackground, LoadingSpinner, NoticeCard } from '../components';
import { useAuth } from '../hooks/useAuth';
import { noticeService } from '../services/noticeService';
import { DrawerTheme } from '../constants/DrawerTheme';
import { CommonStyles } from '../styles/CommonStyles';

const NoticeScreen = ({ isIntegrated = false }) => {
  const { customer } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const { data, error } = await noticeService.getNotices();
    if (!error) setNotices(data);
    if (customer) await noticeService.markAllNoticesAsRead();
    setLoading(false);
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

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>NOTICE BOARD</Text>
      </View>
      <View style={styles.headerDivider} />
      <Text style={styles.subtitle}>매장의 새로운 소식을 확인하세요</Text>
    </View>
  );

  if (loading) return <GradientBackground><LoadingSpinner /></GradientBackground>;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={notices}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <NoticeCard notice={item} />}
        ListHeaderComponent={!isIntegrated ? renderHeader : null}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>아직 등록된 소식이 없습니다.</Text>
          </View>
        }
        contentContainerStyle={[
          styles.listArea,
          { paddingTop: !isIntegrated ? (Platform.OS === 'ios' ? 60 : 40) : 10 }
        ]}
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
  listArea: {
    padding: 20,
    paddingBottom: 100
  },

  // 헤더 (CommonStyles 적용)
  header: CommonStyles.headerBoard,
  titleRow: CommonStyles.titleRow,
  title: CommonStyles.title,
  headerDivider: CommonStyles.headerDivider,
  subtitle: CommonStyles.subtitle,

  // 빈 상태
  emptyBox: {
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 40
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
    opacity: 0.3
  },
  emptyText: {
    fontSize: 15,
    color: DrawerTheme.woodLight,
    fontStyle: 'italic',
    opacity: 0.7
  },
});

export default NoticeScreen;