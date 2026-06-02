import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VoteCard } from './VoteCard';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CellarMark, PremiumCard } from '../common/PremiumUI';

export const VoteList = ({ votes, onSelectVote }) => {
    return (
        <View>
            {votes.length === 0 ? (
                <PremiumCard style={styles.emptyBox} contentStyle={styles.emptyContent}>
                    <View style={styles.emptyFlap} />
                    <CellarMark size={44} style={styles.emptyMark} />
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
    emptyBox: {
        padding: 16,
    },
    emptyContent: {
        width: '100%',
        minHeight: 134,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(200,163,64,0.28)',
        backgroundColor: 'rgba(31,18,12,0.46)',
        overflow: 'hidden',
        gap: 10,
    },
    emptyFlap: {
        position: 'absolute',
        top: -54,
        width: '80%',
        height: 110,
        transform: [{ rotate: '45deg' }],
        borderWidth: 1,
        borderColor: 'rgba(200,163,64,0.16)',
        backgroundColor: 'rgba(18,0,8,0.28)',
    },
    emptyMark: {
        alignSelf: 'center',
    },
    emptyText: {
        width: '100%',
        fontSize: 13,
        color: DrawerTheme.ivory,
        fontWeight: '700',
        textAlign: 'center',
    },
});
