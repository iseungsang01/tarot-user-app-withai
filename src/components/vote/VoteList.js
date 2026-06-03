import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VoteCard } from './VoteCard';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { DrawerMark, PremiumCard } from '../common/PremiumUI';

export const VoteList = ({ votes, onSelectVote }) => {
    return (
        <View>
            {votes.length === 0 ? (
                <PremiumCard style={styles.emptyBox} contentStyle={styles.emptyContent}>
                    <View style={styles.boardIllustration}>
                        <View style={styles.boardFrame}>
                            <View style={styles.boardLine} />
                            <DrawerMark size={24} filled style={styles.boardSeal} />
                            <View style={[styles.boardLine, styles.boardLineShort]} />
                        </View>
                    </View>
                    <Text style={styles.emptyTitle}>진행 중인 투표가 없습니다</Text>
                    <Text style={styles.emptySupport}>새로운 투표가 열리면 이곳에서 확인할 수 있습니다.</Text>
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
