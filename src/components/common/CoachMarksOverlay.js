import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';

const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.72)';

const CoachMarksOverlay = ({ steps, stepIndex, onNext, onClose }) => {
    const step = steps?.[stepIndex];

    if (!step?.frame) {
        return null;
    }

    const { x, y, width, height } = step.frame;
    const holePadding = 8;
    const hole = {
        x: Math.max(0, x - holePadding),
        y: Math.max(0, y - holePadding),
        width: width + holePadding * 2,
        height: height + holePadding * 2,
    };

    const screenHeight = Dimensions.get('window').height;
    const tooltipHeight = 170;
    const tooltipSpacing = 12;
    const bottomSafeGap = 12;
    const tooltipTop = (hole.y + hole.height + tooltipHeight + bottomSafeGap > screenHeight)
        ? Math.max(bottomSafeGap, hole.y - tooltipHeight - tooltipSpacing)
        : hole.y + hole.height + tooltipSpacing;
    const isLast = stepIndex === steps.length - 1;

    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onNext}>
            <View style={[styles.overlayBlock, { left: 0, right: 0, top: 0, height: hole.y }]} />
            <View style={[styles.overlayBlock, { left: 0, top: hole.y, width: hole.x, height: hole.height }]} />
            <View style={[styles.overlayBlock, { left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height }]} />
            <View style={[styles.overlayBlock, { left: 0, right: 0, top: hole.y + hole.height, bottom: 0 }]} />

            <View pointerEvents="none" style={[styles.highlight, hole]} />

            <View style={[styles.tooltip, { top: tooltipTop, left: 20, right: 20 }]}>
                <Text style={styles.title}>{step.title}</Text>
                <Text style={styles.description}>{step.description}</Text>
                <View style={styles.tooltipBottom}>
                    <Text style={styles.counter}>{stepIndex + 1} / {steps.length}</Text>
                    <Pressable onPress={onNext} style={styles.nextButton}>
                        <Text style={styles.nextText}>{isLast ? '완료' : '다음'}</Text>
                    </Pressable>
                </View>
                <Pressable onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeText}>건너뛰기</Text>
                </Pressable>
            </View>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    overlayBlock: {
        position: 'absolute',
        backgroundColor: OVERLAY_COLOR,
    },
    highlight: {
        position: 'absolute',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: DrawerTheme.goldBright,
        backgroundColor: 'transparent',
        zIndex: 5,
        elevation: 5,
    },
    tooltip: {
        position: 'absolute',
        backgroundColor: 'rgba(11, 16, 30, 0.98)',
        borderColor: 'rgba(212,175,55,0.55)',
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        zIndex: 10,
        elevation: 10,
    },
    title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    description: { color: DrawerTheme.woodLight, lineHeight: 18 },
    tooltipBottom: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    counter: { color: DrawerTheme.goldBrass, fontSize: 12 },
    nextButton: {
        backgroundColor: DrawerTheme.goldBrass,
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 14,
    },
    nextText: { color: '#0B1020', fontWeight: '800' },
    closeButton: { marginTop: 8, alignSelf: 'flex-end' },
    closeText: { color: DrawerTheme.woodLight, fontSize: 12 },
});

export default CoachMarksOverlay;
