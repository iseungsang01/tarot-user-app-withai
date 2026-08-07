import { StyleSheet, FlatList, RefreshControl, View } from 'react-native';

import { LoadingSpinner, VoteList, VoteDetail } from '../../../components';
import { DrawerTheme } from '../../../constants/DrawerTheme';
import { useVoteLogic } from '../../../hooks/useVoteLogic';

const VotePanel = () => {
  const { state, actions, helpers } = useVoteLogic();

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
    handleSubmitVote,
  } = actions;

  const { normalizeOptions } = helpers;

  const renderContent = () => {
    if (!selectedVote) {
      return <VoteList votes={votes} onSelectVote={onSelectVote} />;
    }

    if (voteDataLoading) {
      return (
        <View style={styles.inlineLoading}>
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
        onCancel={() => {
          setIsEditMode(false);
          setShowResults(true);
        }}
        onGoBack={() => setSelectedVote(null)}
        onEditRequest={() => {
          setShowResults(false);
          setIsEditMode(true);
        }}
      />
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <FlatList
        data={[{ id: 'vote-panel-content' }]}
        renderItem={renderContent}
        keyExtractor={(item) => item.id}
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
  inlineLoading: {
    height: 400,
    justifyContent: 'center',
  },
});

export default VotePanel;
