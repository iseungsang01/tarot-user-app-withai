import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { VoteResultBar } from './VoteResultBar';

export const VoteDetail = ({
    vote,
    options,
    voteResults,
    myVote,
    selectedOptions,
    participantCount,
    showResults,
    isEditMode,
    isEnded,
    submitting,
    isGuest,
    onOptionToggle,
    onSubmit,
    onCancel,
    onGoBack,
    onEditRequest
}) => {
    const total = Object.values(voteResults).reduce((a, b) => a + b, 0);
    const isResultView = (showResults || isGuest || isEnded) && !isEditMode;

    return (
        <View>
            <TouchableOpacity style={styles.backLink} onPress={onGoBack}>
                <Text style={styles.backLinkText}>⬅ 목록으로 돌아가기</Text>
            </TouchableOpacity>

            <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{vote.title}</Text>
                <View style={styles.detailMeta}>
                    <Text style={styles.metaText}>🗳️ 현재 {participantCount}명 참여 중</Text>
                    {vote.allow_multiple && vote.max_selections && (
                        <Text style={styles.metaText}>• 최대 {vote.max_selections}개 선택 가능</Text>
                    )}
                </View>
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{isResultView ? '📊 결과 현황' : '🗳️ 항목 선택'}</Text>
                    {isResultView && !isGuest && !isEnded && (
                        <TouchableOpacity onPress={onEditRequest}>
                            <Text style={styles.editLink}>다시 투표하기</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {options.map(opt => {
                    const count = voteResults[opt.id] || 0;
                    const pct = total ? Math.round((count / total) * 100) : 0;
                    const isMy = myVote?.selected_options?.includes(opt.id);
                    const isSel = selectedOptions.includes(opt.id);

                    if (isResultView) {
                        return (
                            <VoteResultBar
                                key={opt.id}
                                optionText={opt.text}
                                percentage={pct}
                                isMyChoice={isMy}
                            />
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={opt.id}
                            style={[styles.optBtn, isSel && styles.optSel]}
                            onPress={() => !isGuest && onOptionToggle(opt.id)}
                            activeOpacity={isGuest ? 1 : 0.7}
                        >
                            <View style={[styles.dot, isSel && styles.dotActive]} />
                            <Text style={[styles.optText, isSel && styles.optTextActive]}>{opt.text}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {(!showResults || isEditMode) && (
                <View style={styles.actionContainer}>
                    {isEditMode && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onCancel}
                        >
                            <Text style={styles.cancelButtonText}>돌아가기</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (submitting || isGuest || isEnded) && styles.submitButtonDisabled
                        ]}
                        disabled={submitting || isGuest || isEnded}
                        onPress={onSubmit}
                    >
                        <Text style={styles.submitButtonText}>
                            {isGuest
                                ? '로그인이 필요한 기능입니다'
                                : (isEnded
                                    ? '종료된 투표입니다'
                                    : (submitting ? '처리 중...' : (isEditMode ? '수정 완료' : '투표하기')))
                            }
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    backLink: { marginBottom: 15, paddingLeft: 5 },
    backLinkText: { color: '#A68966', fontSize: 13 },
    detailHeader: { backgroundColor: '#4A3728', borderRadius: 16, padding: 22, marginBottom: 20 },
    detailTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
    detailMeta: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 15 },
    metaText: { fontSize: 12, color: '#A68966', marginBottom: 4 },
    section: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
    sectionTitle: { color: DrawerTheme.goldBrass, fontSize: 15, fontWeight: 'bold' },
    editLink: { color: '#888', fontSize: 12, textDecorationLine: 'underline' },
    optBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        padding: 18,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    optSel: { borderColor: DrawerTheme.goldBrass, backgroundColor: 'rgba(212, 175, 55, 0.05)' },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 15 },
    dotActive: { backgroundColor: DrawerTheme.goldBrass },
    optText: { color: '#AAA', fontSize: 15 },
    optTextActive: { color: '#FFF', fontWeight: 'bold' },
    actionContainer: {
        flexDirection: 'row',
        marginTop: 25,
        gap: 12,
    },
    submitButton: {
        flex: 1,
        backgroundColor: DrawerTheme.goldBrass,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    submitButtonDisabled: {
        backgroundColor: '#3D2B1F',
        opacity: 0.5,
    },
    submitButtonText: {
        color: '#3D2B1F',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        flex: 0.4,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: '#AAA',
        fontSize: 16,
    },
});
