import React, { useCallback } from 'react';
import { StyleSheet, FlatList, RefreshControl, Platform, View, Text } from 'react-native';

// Components
import { GradientBackground } from '../components/GradientBackground';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { VoteList } from '../components/vote/VoteList';
import { VoteDetail } from '../components/vote/VoteDetail';
import { DrawerTheme } from '../constants/DrawerTheme';
import { CommonStyles } from '../styles/CommonStyles';

// Hook
import { useVoteLogic } from '../hooks/useVoteLogic';

const VoteScreen = ({ navigation, isIntegrated = false }) => {
  const {
    state,
    actions,
    helpers
  } = useVoteLogic();

  const {
    votes,
    selectedVote,
    selectedOptions,
    myVote,
    voteResults,
    participantCount,
    loading,
    voteDataLoading,
    refreshing,
    submitting,
    showResults,
    isEditMode,
    customer,
    isEnded,
  } = state;

  const {
    setSelectedVote,
    setIsEditMode,
    setShowResults,
    handleRefresh,
    onSelectVote,
    handleOptionToggle,
    handleSubmitVote
  } = actions;

  const { normalizeOptions } = helpers;

  const renderContent = () => {
    if (!selectedVote) {
      return (
        <VoteList
          votes={votes}
          onSelectVote={onSelectVote}
        />
      );
    }

    if (voteDataLoading) {
      return (
        <View style={{ height: 400, justifyContent: 'center' }}>
          <LoadingSpinner message="투표 데이터를 가져오는 중..." />
        </View>
      );
    }

    const options = normalizeOptions(selectedVote.options);

    return (
      <VoteDetail
        vote={selectedVote}
        options={options}
        voteResults={voteResults}
        myVote={myVote}
        selectedOptions={selectedOptions}
        participantCount={participantCount}
        showResults={showResults}
        isEditMode={isEditMode}
        isEnded={isEnded}
        submitting={submitting}
        isGuest={customer?.isGuest}
        onOptionToggle={handleOptionToggle}
        onSubmit={handleSubmitVote}
        onCancel={() => { setIsEditMode(false); setShowResults(true); }}
        onGoBack={() => setSelectedVote(null)}
        onEditRequest={() => { setShowResults(false); setIsEditMode(true); }}
      />
    );
  };

  if (loading) return <GradientBackground><LoadingSpinner /></GradientBackground>;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={[{ id: 1 }]}
        renderItem={renderContent}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={!isIntegrated ? (
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>VOTE BOARD</Text>
            </View>
            <View style={styles.headerDivider} />
            <Text style={styles.subtitle}>오늘의 선택을 남기고 결과를 확인해보세요</Text>
          </View>
        ) : null}
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
  header: CommonStyles.headerBoard,
  titleRow: CommonStyles.titleRow,
  title: CommonStyles.title,
  headerDivider: CommonStyles.headerDivider,
  subtitle: CommonStyles.subtitle,
});

export default VoteScreen;
