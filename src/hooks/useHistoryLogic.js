import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVisits } from './useVisits';
import { useAuth } from './useAuth';
import { visitService } from '../services/visitService';
import { handleApiCall, showSuccessAlert } from '../utils/errorHandler';
import { storage, STORAGE_KEYS } from '../utils/storage';

import { dialog } from '../utils/dialog';
const hasWrittenRecord = (item) => (
    !!(item?.card_review && item.card_review.trim()) || !!item?.card_image
);

/**
 * 모달·다이얼로그가 닫히는 애니메이션 길이. 삭제가 끝나도 이만큼은 기다렸다가
 * 완료 안내를 띄운다. 서랍이 사라지는 것과 안내가 뜨는 것이 겹치면
 * 화면이 따로 노는 것처럼 보이고, iOS 에서는 닫히는 중인 모달 위로
 * 새 모달을 띄우려다 안내가 아예 안 뜨기도 한다.
 */
const UI_SETTLE_MS = 320;

const settle = () => new Promise((resolve) => setTimeout(resolve, UI_SETTLE_MS));

const getVisitTime = (item) => {
    const time = new Date(item?.visit_date || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
};

const getGroupTitle = (item, viewMode) => {
    const date = new Date(item?.visit_date || 0);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (!year || Number.isNaN(year)) return '날짜 없는 기록';
    if (viewMode === 'month') return `${year}년 ${month}월`;
    return `${year}년`;
};

const groupHistoryItems = (items, viewMode) => {
    if (viewMode === 'all') return items;

    const output = [];
    let currentTitle = null;

    items.forEach((item) => {
        const title = getGroupTitle(item, viewMode);
        if (title !== currentTitle) {
            currentTitle = title;
            output.push({ id: `group-${viewMode}-${title}`, type: 'groupHeader', title });
        }
        output.push(item);
    });

    return output;
};

export const useHistoryLogic = (navigation) => {
    const { customer, refreshCustomer } = useAuth();
    const abortControllerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [customer?.id]);

    const {
        visits: serverVisits,
        isLoading: isVisitsLoading,
        isDeleting,
        refetch,
        deleteVisit,
        deleteMultipleVisits
    } = useVisits(customer?.id);

    const [personalNotes, setPersonalNotes] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const [recordType, setRecordType] = useState('all');
    const [viewMode, setViewMode] = useState('all');
    const [sortMode, setSortMode] = useState('latest');
    const [recordStatus, setRecordStatus] = useState('all');

    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [selectedItem, setSelectedItem] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const loadLocalData = useCallback(async () => {
        try {
            const localData = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
            const formattedNotes = localData.map(v => ({ ...v, is_manual: true }));
            setPersonalNotes(formattedNotes);
        } catch (e) {
            console.error('Failed to load local data', e);
        }
    }, []);

    const refreshAllData = useCallback(async (signal) => {
        try {
            await Promise.all([refetch(), loadLocalData()]);
        } catch (e) {
            if (signal && signal.aborted) return;
            console.error(e);
        }
    }, [refetch, loadLocalData]);

    const handleRefresh = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setRefreshing(true);
        await refreshAllData(controller.signal);
        if (abortControllerRef.current === controller) {
            setRefreshing(false);
        }
    };

    const formattedServerVisits = useMemo(
        () => serverVisits.map((visit) => ({ ...visit, is_manual: false })),
        [serverVisits]
    );

    const allVisits = useMemo(
        () => [...formattedServerVisits, ...personalNotes],
        [formattedServerVisits, personalNotes]
    );

    const filteredVisits = useMemo(() => {
        let data = [];

        if (recordType === 'visit') data = formattedServerVisits;
        else if (recordType === 'personal') data = personalNotes;
        else data = allVisits;

        if (recordStatus === 'hasRecord') {
            data = data.filter(hasWrittenRecord);
        } else if (recordStatus === 'empty') {
            data = data.filter((item) => !hasWrittenRecord(item));
        }

        return [...data].sort((a, b) => {
            const diff = getVisitTime(b) - getVisitTime(a);
            return sortMode === 'latest' ? diff : -diff;
        });
    }, [recordType, recordStatus, sortMode, formattedServerVisits, personalNotes, allVisits]);

    const displayData = useMemo(
        () => groupHistoryItems(filteredVisits, viewMode),
        [filteredVisits, viewMode]
    );

    // 화면에 보이는 기록만. 선택 상태를 정리할 때 쓴다.
    const displayDataById = useMemo(
        () => new Map(filteredVisits.map((visit) => [visit.id, visit])),
        [filteredVisits]
    );

    // 필터와 무관한 전체 목록. 삭제·수정 대상을 찾을 때는 이쪽을 봐야
    // 필터에 가려진 기록도 놓치지 않는다.
    const visitsById = useMemo(
        () => new Map(allVisits.map((visit) => [visit.id, visit])),
        [allVisits]
    );

    // 모달이 열려 있는 동안 목록이 갱신되면 모달 내용도 같이 따라가야 한다.
    // (기록이 삭제돼 사라진 경우에는 닫히는 중이므로 마지막 내용을 유지한다)
    useEffect(() => {
        setSelectedItem((prev) => {
            if (!prev) return prev;
            const live = visitsById.get(prev.id);
            return live && live !== prev ? live : prev;
        });
    }, [visitsById]);

    // 필터를 바꿔 화면에서 사라진 기록이 "N개 선택됨" 에 남아 있으면
    // 보이지도 않는 것을 지우게 된다.
    useEffect(() => {
        if (!selectionMode) return;
        setSelectedIds((prev) => {
            const next = new Set();
            prev.forEach((id) => {
                if (displayDataById.has(id)) next.add(id);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [selectionMode, displayDataById]);

    const toggleSelection = useCallback((id) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

    const handleLongPress = useCallback((visitId) => {
        if (!selectionMode) {
            setSelectionMode(true);
            setSelectedIds(new Set([visitId]));
        } else {
            toggleSelection(visitId);
        }
    }, [selectionMode, toggleSelection]);

    const handleDeleteVisit = useCallback(async (visitId) => {
        // 넘겨받은 id 로 찾는다. 열려 있던 모달을 믿고 지우면 다른 기록이
        // 지워질 수 있고, 필터에 가려진 기록은 전체 목록에서 찾아야 한다.
        const itemToDelete = visitsById.get(visitId);

        if (!itemToDelete) {
            dialog.alert('오류', '삭제할 기록을 찾을 수 없습니다.');
            return;
        }

        // 상세 모달을 먼저 닫고, 목록에서 서랍이 실제로 빠지고 닫힘
        // 애니메이션이 끝난 뒤에 완료 안내를 띄운다.
        setIsModalVisible(false);

        try {
            const removal = itemToDelete.is_manual
                ? (async () => {
                    const list = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
                    await storage.save(STORAGE_KEYS.OFFLINE_VISIT_HISTORY, list.filter(v => v.id !== visitId));
                    await loadLocalData();
                })()
                : (async () => {
                    await deleteVisit(visitId);
                    await refreshCustomer();
                })();

            await Promise.all([removal, settle()]);
            showSuccessAlert('DELETE');
        } catch (error) {
            console.error('기록 삭제 오류:', error);
            dialog.alert('오류', '삭제 중 문제가 발생했습니다.');
        }
    }, [visitsById, loadLocalData, deleteVisit, refreshCustomer]);

    const handleUpdateVisitReview = useCallback(async (visit, nextReview) => {
        if (!visit?.id) {
            dialog.alert('오류', '수정할 기록을 찾을 수 없습니다.');
            return;
        }

        try {
            if (visit.is_manual) {
                const list = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
                const nextList = list.map((item) => (
                    item.id === visit.id ? { ...item, card_review: nextReview } : item
                ));
                await storage.save(STORAGE_KEYS.OFFLINE_VISIT_HISTORY, nextList);
                await loadLocalData();
            } else {
                const { error } = await handleApiCall(
                    'HistoryScreen.updateReview',
                    () => visitService.updateVisit(visit.id, { card_review: nextReview }),
                );
                if (error) throw error;
                await refetch();
            }

            // 모달 내용은 visitsById 동기화 effect 가 목록과 함께 맞춰준다.
            showSuccessAlert('UPDATE', '기록이 반영되었습니다.');
        } catch (error) {
            console.error('기록 저장 오류:', error);
            dialog.alert('오류', '기록을 저장하는 중 문제가 발생했습니다.');
        }
    }, [loadLocalData, refetch]);

    const handleMultiDelete = useCallback(async () => {
        if (selectedIds.size === 0) {
            dialog.alert('선택 없음', '삭제할 기록을 선택해주세요.');
            return;
        }

        dialog.alert(
            '여러 기록 삭제',
            `선택한 기록 ${selectedIds.size}개를 정말 삭제하시겠습니까?`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => {
                        const serverIds = [];
                        const localIds = [];

                        selectedIds.forEach((id) => {
                            const item = visitsById.get(id);
                            if (item) {
                                item.is_manual ? localIds.push(id) : serverIds.push(id);
                            }
                        });

                        // 선택 UI 는 바로 걷는다. 남겨두면 이미 지워진 서랍이
                        // "N개 선택됨" 으로 계속 세어진다.
                        setSelectedIds(new Set());
                        setSelectionMode(false);

                        try {
                            const removal = (async () => {
                                if (serverIds.length > 0) await deleteMultipleVisits(serverIds);

                                if (localIds.length > 0) {
                                    const list = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
                                    await storage.save(
                                        STORAGE_KEYS.OFFLINE_VISIT_HISTORY,
                                        list.filter(v => !localIds.includes(v.id)),
                                    );
                                    await loadLocalData();
                                }

                                if (serverIds.length > 0) await refreshCustomer();
                            })();

                            await Promise.all([removal, settle()]);
                            showSuccessAlert('DELETE');
                        } catch (error) {
                            console.error('여러 기록 삭제 오류:', error);
                            dialog.alert('오류', '삭제 중 문제가 발생했습니다.');
                        }
                    }
                }
            ]
        );
    }, [selectedIds, visitsById, deleteMultipleVisits, loadLocalData, refreshCustomer]);

    return {
        state: {
            customer,
            isVisitsLoading,
            isDeleting,
            refreshing,
            visits: allVisits,
            displayData,
            recordType,
            viewMode,
            sortMode,
            recordStatus,
            selectionMode,
            selectedIds,
            isModalVisible,
            selectedItem,
        },
        actions: {
            setRecordType,
            setViewMode,
            setSortMode,
            setRecordStatus,
            setSelectionMode,
            setSelectedIds,
            setIsModalVisible,
            setSelectedItem,
            refreshAllData,
            handleRefresh,
            toggleSelection,
            handleLongPress,
            handleDeleteVisit,
            handleUpdateVisitReview,
            handleMultiDelete
        }
    };
};
