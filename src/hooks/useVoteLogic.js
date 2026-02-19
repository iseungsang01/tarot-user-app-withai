import { useState, useCallback } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from './useAuth';
import { voteService } from '../services/voteService';
import { handleApiCall } from '../utils/errorHandler';

export const useVoteLogic = () => {
    const { customer } = useAuth();

    // State
    const [votes, setVotes] = useState([]);
    const [myVoteMap, setMyVoteMap] = useState({}); // ✅ 내 투표 기록 전체 캐싱
    const [selectedVote, setSelectedVote] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [myVote, setMyVote] = useState(null);
    const [voteResults, setVoteResults] = useState({});
    const [participantCount, setParticipantCount] = useState(0);

    // UI State
    const [loading, setLoading] = useState(false); // ✅ 초기값을 false로 변경하여 깜빡임 제거
    const [voteDataLoading, setVoteDataLoading] = useState(false); // ✅ 투표 상세 데이터 로딩 상태
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Load list of votes and my responses
    const loadVotes = useCallback(async () => {
        // 1. 투표 목록 로드
        const { data: votesData, error: votesError } = await handleApiCall('VoteScreen.loadVotes', () => voteService.getVotes());

        // 2. 내 투표 기록 로드 (병렬 처리)
        const { data: myResponseMap } = await handleApiCall('VoteScreen.loadMyResp', () => voteService.getMyAllResponses(customer.id), { showAlert: false });

        if (!votesError && votesData) {
            setVotes(votesData);
        }
        if (myResponseMap) {
            setMyVoteMap(myResponseMap);
        }
        setLoading(false);
    }, [customer.id]);

    // Initial load
    useFocusEffect(useCallback(() => { loadVotes(); }, [loadVotes]));

    // Load specific vote data (Results & Counts only)
    const loadVoteData = useCallback(async (vId) => {
        setVoteDataLoading(true);
        try {
            const [resRes, countRes] = await Promise.all([
                // voteService.getMyVote(vId, customer.id), // ❌ 이미 myVoteMap에서 가져왔으므로 네트워크 요청 제거
                handleApiCall('VoteScreen.loadVoteResults', () => voteService.getVoteResults(vId), { showAlert: false }),
                handleApiCall('VoteScreen.loadCount', () => voteService.getVoteParticipants(vId), { showAlert: false })
            ]);

            const finalResults = resRes.data?.results || {};
            setVoteResults(finalResults);
            setParticipantCount(countRes.data?.count || 0);

            // 결과 화면 업데이트 (이미 보여지고 있겠지만 최신 데이터로 업데이트)
            // setShowResults(!!myVote); // ❌ onSelectVote에서 이미 처리했으므로 제거
        } catch (e) {
            console.error(e);
        } finally {
            setVoteDataLoading(false);
        }
    }, [customer.id]);

    // Back Handler for returning to list
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (selectedVote) {
                    setSelectedVote(null);
                    setIsEditMode(false);
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [selectedVote])
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadVotes();
        setRefreshing(false);
    };

    const isVoteEnded = (vote) => {
        if (!vote) return false;
        if (vote.ends_at && new Date(vote.ends_at) < new Date()) {
            return true;
        }
        return false;
    };

    const onSelectVote = async (vote) => {
        setVoteDataLoading(true);
        setSelectedVote(vote);

        // ✅ 잔상 제거: 이전 결과 초기화
        setVoteResults({});
        setParticipantCount(0);

        // ✅ 1. 캐시된 내 투표 정보 즉시 적용 (딜레이 제거)
        const cachedMyVote = myVoteMap[vote.id] || null;
        setMyVote(cachedMyVote);
        setSelectedOptions(cachedMyVote?.selected_options || []);

        // 종료된 투표인 경우 결과 화면을 우선적으로 보여줌
        const isEnded = isVoteEnded(vote);
        setShowResults(!!cachedMyVote || isEnded);

        // 2. 백그라운드에서 최신 집계 데이터 로드
        await loadVoteData(vote.id);
    };

    const handleOptionToggle = (optionId) => {
        if (isVoteEnded(selectedVote)) return;

        if (!selectedVote.allow_multiple) {
            setSelectedOptions(prev => prev.includes(optionId) ? [] : [optionId]);
        } else {
            setSelectedOptions(prev =>
                prev.includes(optionId)
                    ? prev.filter(i => i !== optionId)
                    : [...prev, optionId]
            );
        }
    };

    const handleSubmitVote = async () => {
        if (submitting) return;

        // 종료된 투표인지 확인
        if (isVoteEnded(selectedVote)) {
            Alert.alert('알림', '이미 종료된 투표입니다.', [{ text: '확인' }]);
            return;
        }

        // Validation
        if (selectedVote.allow_multiple && selectedVote.max_selections) {
            if (selectedOptions.length > selectedVote.max_selections) {
                Alert.alert('선택 초과', `최대 ${selectedVote.max_selections}개까지만 선택 가능합니다.`, [{ text: '확인' }]);
                return;
            }
        }

        // Cancel checks
        const isSingleCancel = !selectedVote.allow_multiple && selectedOptions.length === 0 && myVote;
        const isMultiCancel = selectedVote.allow_multiple && selectedOptions.length === 0 && myVote;

        if (isSingleCancel || isMultiCancel) {
            setSubmitting(true);
            const { error } = await handleApiCall(
                'VoteScreen.cancelVote',
                () => voteService.cancelVote(selectedVote.id, customer.id)
            );

            if (!error) {
                // 로컬 상태 업데이트
                setMyVoteMap(prev => {
                    const next = { ...prev };
                    delete next[selectedVote.id];
                    return next;
                });
                setMyVote(null);

                await loadVoteData(selectedVote.id);
                setIsEditMode(false);
                setShowResults(false);
            }
            setSubmitting(false);
            return;
        }

        // New vote Validation
        if (selectedOptions.length === 0 && !myVote) {
            Alert.alert('알림', '최소 1개 이상 선택해주세요.', [{ text: '확인' }]);
            return;
        }

        // Submit
        setSubmitting(true);
        const res = await handleApiCall(
            'VoteScreen.submitVote',
            () => voteService.submitVote(selectedVote.id, customer.id, selectedOptions, myVote?.id),
            { successMessage: isEditMode ? '투표가 수정되었습니다.' : '투표가 완료되었습니다.' }
        );

        if (res.data) {
            // 로컬 상태 업데이트
            setMyVoteMap(prev => ({ ...prev, [selectedVote.id]: res.data }));
            setMyVote(res.data);

            await loadVoteData(selectedVote.id);
            setIsEditMode(false);
            setShowResults(true);
        }
        setSubmitting(false);
    };

    // Helper logic for rendering
    const normalizeOptions = (opts) => {
        if (Array.isArray(opts)) return opts.map((t, i) => ({ id: i, text: typeof t === 'string' ? t : t.text || t }));
        if (opts) return Object.entries(opts).map(([k, v]) => ({ id: parseInt(k), text: v }));
        return [];
    };

    return {
        state: {
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
            customer, // exposing customer for guest check logic in UI
            isEnded: isVoteEnded(selectedVote),
        },
        actions: {
            setSelectedVote,
            setIsEditMode,
            setShowResults,
            handleRefresh,
            onSelectVote,
            handleOptionToggle,
            handleSubmitVote
        },
        helpers: {
            normalizeOptions
        }
    };
};
