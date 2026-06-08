import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ArchiveTitleHeader } from '../common/PremiumUI';

export const HistoryHeader = () => (
    <View style={styles.wrap}>
        <ArchiveTitleHeader
            eyebrow="PRIVATE TAROT CELLAR"
            title="DRAWER ARCHIVE"
            subtitle="서랍 기록 보관함"
        />
    </View>
);

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 0,
        marginBottom: -6,
    },
});
