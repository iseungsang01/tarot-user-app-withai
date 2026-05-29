import { useState, useCallback, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from './useAuth';
import { voteService } from '../services/voteService';
import { handleApiCall } from '../utils/errorHandler';

export const useVoteLogic = () => {
    const { customer } = useAuth();

    // State
    const [votes, setVotes] = useState([]);
    const [myVoteMap, setMyVoteMap] = useState({});
    const [selectedVote, setSelectedVote] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [myVote, setMyVote] = useState(null);
    const [voteResults, setVoteResults] = useState({});
    const [participantCount, setParticipantCount] = useState(0);

    // UI State
    const [loading, setLoading] = useState(false);
    const [voteDataLoading, setVoteDataLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Refs for debouncing and double-submit prevention
    const isSubmittingRef = useRef(false);
    const lastToggleTimeRef = useRef(0);

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
                handleApiCall('VoteScreen.loadVoteResults', () => voteService.getVoteResults(vId), { showAlert: false }),
                handleApiCall('VoteScreen.loadCount', () => voteService.getVoteParticipants(vId), { showAlert: false })
            ]);

            const finalResults = resRes.data?.results || {};
            setVoteResults(finalResults);
            setParticipantCount(countRes.data?.count || 0);

        } catch (e) {
            console.error(e);
        } finally {
            setVoteDataLoading(false);
        }
    }, []);

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

    const isVoteEnded = (vote) => !!vote?.ends_at && new Date(vote.ends_at) < new Date();

    const onSelectVote = async (vote) => {
        setVoteDataLoading(true);
        setSelectedVote(vote);

        // 이전 결과 초기화
        setVoteResults({});
        setParticipantCount(0);

        // 캐시된 내 투표 정보 즉시 적용
        const cachedMyVote = myVoteMap[vote.id] || null;
        setMyVote(cachedMyVote);
        setSelectedOptions(cachedMyVote?.selected_options || []);

        // 종료된 투표인 경우 결과 화면을 우선적으로 보여줌
        const isEnded = isVoteEnded(vote);
        setShowResults(!!cachedMyVote || isEnded);

        // 백그라운드에서 최신 집계 데이터 로드
        await loadVoteData(vote.id);
    };

    const handleOptionToggle = (optionId) => {
        if (isVoteEnded(selectedVote)) return;
        if (submitting || isSubmittingRef.current) return;

        const now = Date.now();
        // Prevent rapid duplicate clicks (throttling 200ms)
        if (now - lastToggleTimeRef.current < 200) {
            return;
        }
        lastToggleTimeRef.current = now;

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
        if (submitting || isSubmittingRef.current) return;
        if (!selectedVote) return;

        isSubmittingRef.current = true;
        setSubmitting(true);

        try {
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
            const isCancelRequest = selectedOptions.length === 0 && !!myVote;

            if (isCancelRequest) {
                try {
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
                } catch (error) {
                    console.error('Cancel vote error:', error);
                }
                return;
            }

            // New vote Validation
            if (selectedOptions.length === 0 && !myVote) {
                Alert.alert('알림', '최소 1개 이상 선택해주세요.', [{ text: '확인' }]);
                return;
            }

            // Submit
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
        } finally {
            isSubmittingRef.current = false;
            setSubmitting(false);
        }
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
