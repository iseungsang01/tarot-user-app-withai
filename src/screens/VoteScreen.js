import React, { useCallback } from 'react';
import { StyleSheet, FlatList, RefreshControl, Platform, View } from 'react-native';

// Components
import { GradientBackground } from '../components/GradientBackground';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { VoteList } from '../components/vote/VoteList';
import { VoteDetail } from '../components/vote/VoteDetail';
import { DrawerTheme } from '../constants/DrawerTheme';

// Hook
import { useVoteLogic } from '../hooks/useVoteLogic';

const VoteScreen = ({ navigation }) => {
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
    <GradientBackground>
      <FlatList
        data={[{ id: 1 }]}
        renderItem={renderContent}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listArea}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={DrawerTheme.goldBrass}
          />
        }
      />
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  listArea: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 100
  },
});

export default VoteScreen;