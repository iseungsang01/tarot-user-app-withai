import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';

export const VoteResultBar = ({ optionText, percentage, isMyChoice }) => {
    return (
        <View style={[styles.resBar, isMyChoice && styles.resMy]}>
            <View style={[styles.progress, { width: `${percentage}%` }]} />
            <View style={styles.resContent}>
                <Text style={[styles.resText, isMyChoice && styles.resTextMy]}>
                    {isMyChoice && '✓ '}{optionText}
                </Text>
                <Text style={styles.resPct}>{percentage}%</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    resBar: {
        height: 52,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 10,
        marginBottom: 10,
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    resMy: { borderColor: 'rgba(212, 175, 55, 0.3)' },
    progress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(212, 175, 55, 0.15)' },
    resContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15 },
    resText: { color: '#999', fontSize: 14 },
    resTextMy: { color: DrawerTheme.goldBright, fontWeight: 'bold' },
    resPct: { color: '#666', fontSize: 12 },
});
