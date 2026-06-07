import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';

const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.72)';

const CoachMarksOverlay = ({
    steps,
    stepIndex,
    onNext,
    onPrevious,
    onClose,
}) => {
    const step = steps?.[stepIndex];
    const { height: screenHeight } = useWindowDimensions();

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
    const holeStyle = {
        left: hole.x,
        top: hole.y,
        width: hole.width,
        height: hole.height,
    };

    const tooltipHeight = step.interactive ? 208 : 188;
    const tooltipSpacing = 12;
    const bottomSafeGap = 12;
    const tooltipTop = (hole.y + hole.height + tooltipHeight + bottomSafeGap > screenHeight)
        ? Math.max(bottomSafeGap, hole.y - tooltipHeight - tooltipSpacing)
        : hole.y + hole.height + tooltipSpacing;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === steps.length - 1;

    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                <View style={[styles.overlayBlock, { left: 0, right: 0, top: 0, height: hole.y }]} />
                <View style={[styles.overlayBlock, { left: 0, top: hole.y, width: hole.x, height: hole.height }]} />
                <View style={[styles.overlayBlock, { left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height }]} />
                <View style={[styles.overlayBlock, { left: 0, right: 0, top: hole.y + hole.height, bottom: 0 }]} />

                {/*
                    Do not place a Pressable over the highlighted target.
                    Interactive coach steps must let the real underlying
                    control receive the tap; that control advances the step.
                */}

                <View pointerEvents="none" style={[styles.highlight, holeStyle]} />

                <View style={[styles.tooltip, { top: tooltipTop, left: 20, right: 20 }]}>
                    <Text style={styles.eyebrow}>APP GUIDE</Text>
                    <Text style={styles.title}>{step.title}</Text>
                    <Text style={styles.description}>{step.description}</Text>
                    {step.interactive && (
                        <Text style={styles.tapGuide}>
                            빛나는 영역을 직접 눌러 체험하세요. 필요하면 다음 버튼으로 넘어갈 수 있습니다.
                        </Text>
                    )}

                    <View style={styles.tooltipBottom}>
                        <Text style={styles.counter}>{stepIndex + 1} / {steps.length}</Text>
                        <View style={styles.actions}>
                            {!isFirst && (
                                <Pressable accessibilityRole="button" onPress={onPrevious} style={styles.secondaryButton}>
                                    <Text style={styles.secondaryText}>이전</Text>
                                </Pressable>
                            )}
                            <Pressable accessibilityRole="button" onPress={onNext} style={styles.nextButton}>
                                <Text style={styles.nextText}>{isLast ? '완료' : '다음'}</Text>
                            </Pressable>
                        </View>
                    </View>

                    <Pressable accessibilityRole="button" accessibilityLabel="가이드 건너뛰기" onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeText}>건너뛰기</Text>
                    </Pressable>
                </View>
            </View>
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
        borderRadius: 14,
        padding: 14,
        zIndex: 10,
        elevation: 10,
    },
    eyebrow: {
        color: DrawerTheme.goldBrass,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.4,
        marginBottom: 5,
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 6,
    },
    description: {
        color: DrawerTheme.woodLight,
        lineHeight: 19,
    },
    tapGuide: {
        color: DrawerTheme.goldBrass,
        marginTop: 8,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
    },
    tooltipBottom: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    counter: {
        color: DrawerTheme.goldBrass,
        fontSize: 12,
        fontWeight: '700',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    secondaryButton: {
        borderColor: 'rgba(212,175,55,0.45)',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 13,
    },
    secondaryText: {
        color: DrawerTheme.woodLight,
        fontWeight: '800',
    },
    nextButton: {
        backgroundColor: DrawerTheme.goldBrass,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 15,
    },
    nextText: {
        color: '#0B1020',
        fontWeight: '900',
    },
    closeButton: {
        marginTop: 10,
        alignSelf: 'flex-end',
    },
    closeText: {
        color: DrawerTheme.woodLight,
        fontSize: 12,
    },
});

export default CoachMarksOverlay;
