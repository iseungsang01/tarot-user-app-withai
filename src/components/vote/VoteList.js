import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VoteCard } from './VoteCard';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CellarMark, PremiumCard } from '../common/PremiumUI';

export const VoteList = ({ votes, onSelectVote }) => {
    return (
        <View>
            <PremiumCard variant="walnut" style={styles.previewCard}>
                <Text style={styles.previewTitle}>최근 소식</Text>
                <Text style={styles.previewText}>진행 중인 투표와 공지를 이곳에서 확인할 수 있습니다.</Text>
            </PremiumCard>

            {votes.length === 0 ? (
                <PremiumCard style={styles.emptyBox}>
                    <CellarMark size={44} />
                    <Text style={styles.emptyText}>진행 중인 투표가 없습니다.</Text>
                </PremiumCard>
            ) : (
                votes.map(v => (
                    <VoteCard
                        key={v.id}
                        vote={v}
                        onPress={onSelectVote}
                    />
                ))
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    previewCard: {
        marginBottom: 14,
    },
    previewTitle: {
        color: DrawerTheme.goldBrass,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.2,
        marginBottom: 6,
    },
    previewText: {
        color: DrawerTheme.ivory,
        fontSize: 13,
        lineHeight: 19,
    },
    emptyBox: {
        alignItems: 'center',
        paddingVertical: 42,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: DrawerTheme.ivory,
        fontWeight: '700',
    },
});
