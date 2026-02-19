import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { VoteCard } from '../VoteCard'; // Assuming VoteCard is in src/components/
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';

export const VoteList = ({ votes, onSelectVote }) => {
    return (
        <View>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={styles.title}>VOTE BOX</Text>
                </View>
                <View style={styles.headerDivider} />
                <Text style={styles.subtitle}>여러분의 소중한 의견을 들려주세요</Text>
            </View>

            {votes.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyIcon}>🗳️</Text>
                    <Text style={styles.emptyText}>진행 중인 투표가 없습니다.</Text>
                </View>
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
    header: CommonStyles.headerBoard,
    titleRow: CommonStyles.titleRow,
    title: CommonStyles.title,
    headerDivider: CommonStyles.headerDivider,
    subtitle: CommonStyles.subtitle,
    emptyBox: { alignItems: 'center', paddingTop: 100, paddingBottom: 40 },
    emptyIcon: { fontSize: 64, marginBottom: 20, opacity: 0.3 },
    emptyText: { fontSize: 15, color: DrawerTheme.woodLight, fontStyle: 'italic', opacity: 0.7 }
});
