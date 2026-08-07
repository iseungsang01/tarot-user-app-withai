import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useVisits } from './useVisits';
import { useAuth } from './useAuth';
import { visitService } from '../services/visitService';
import { handleApiCall, showSuccessAlert } from '../utils/errorHandler';
import { storage, STORAGE_KEYS } from '../utils/storage';

const hasWrittenRecord = (item) => (
    !!(item?.card_review && item.card_review.trim()) || !!item?.card_image
);

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

    const displayDataById = useMemo(
        () => new Map(filteredVisits.map((visit) => [visit.id, visit])),
        [filteredVisits]
    );

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
        try {
            let itemToDelete = selectedItem;
            if (!itemToDelete) {
                itemToDelete = displayDataById.get(visitId);
            }

            if (!itemToDelete) {
                Alert.alert('오류', '삭제할 기록을 찾을 수 없습니다.');
                return;
            }

            if (itemToDelete.is_manual) {
                const list = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
                const filtered = list.filter(v => v.id !== visitId);
                await storage.save(STORAGE_KEYS.OFFLINE_VISIT_HISTORY, filtered);
                await loadLocalData();
            } else {
                await deleteVisit(visitId);
                await refreshCustomer();
            }

            showSuccessAlert('DELETE', Alert);
            setIsModalVisible(false);
        } catch (error) {
            Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
            console.error(error);
        }
    }, [selectedItem, displayDataById, loadLocalData, deleteVisit, refreshCustomer]);

    const handleUpdateVisitReview = useCallback(async (visit, nextReview) => {
        if (!visit?.id) {
            Alert.alert('오류', '수정할 기록을 찾을 수 없습니다.');
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

            setSelectedItem((prev) => (prev?.id === visit.id ? { ...prev, card_review: nextReview } : prev));
            showSuccessAlert('UPDATE', Alert, '기록이 반영되었습니다.');
        } catch (error) {
            console.error('기록 저장 오류:', error);
            Alert.alert('오류', '기록을 저장하는 중 문제가 발생했습니다.');
        }
    }, [loadLocalData, refetch]);

    const handleMultiDelete = useCallback(async () => {
        if (selectedIds.size === 0) {
            Alert.alert('선택 없음', '삭제할 기록을 선택해주세요.');
            return;
        }

        Alert.alert(
            '여러 기록 삭제',
            `선택한 기록 ${selectedIds.size}개를 정말 삭제하시겠습니까?`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const serverIds = [];
                            const localIds = [];

                            selectedIds.forEach((id) => {
                                const item = displayDataById.get(id);
                                if (item) {
                                    item.is_manual ? localIds.push(id) : serverIds.push(id);
                                }
                            });

                            if (serverIds.length > 0) {
                                await deleteMultipleVisits(serverIds);
                            }

                            if (localIds.length > 0) {
                                const list = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
                                const filtered = list.filter(v => !localIds.includes(v.id));
                                await storage.save(STORAGE_KEYS.OFFLINE_VISIT_HISTORY, filtered);
                                await loadLocalData();
                            }

                            showSuccessAlert('DELETE', Alert);
                            setSelectedIds(new Set());
                            setSelectionMode(false);
                            if (serverIds.length > 0) await refreshCustomer();
                        } catch (error) {
                            console.error('여러 기록 삭제 오류:', error);
                            Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
                        }
                    }
                }
            ]
        );
    }, [selectedIds, displayDataById, deleteMultipleVisits, loadLocalData, refreshCustomer]);

    return {
        state: {
            customer,
            isVisitsLoading,
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
