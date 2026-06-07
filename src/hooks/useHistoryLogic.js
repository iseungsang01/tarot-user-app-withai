import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useVisits } from './useVisits';
import { useAuth } from './useAuth';
import { visitService } from '../services/visitService';
import { handleApiCall, showSuccessAlert } from '../utils/errorHandler';
import { storage, STORAGE_KEYS } from '../utils/storage';

export const useHistoryLogic = (navigation) => {
    const { customer, refreshCustomer } = useAuth();
    const abortControllerRef = useRef(null);

    // Cancel pending requests on user change
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [customer?.id]);

    // React Query for server visits
    const {
        visits: serverVisits,
        isLoading: isVisitsLoading,
        refetch,
        deleteVisit,
        deleteMultipleVisits
    } = useVisits(customer?.id);

    // Local state
    const [personalNotes, setPersonalNotes] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        current_stamps: customer?.current_stamps || 0,
        visit_count: customer?.visit_count || 0
    });

    // Filter state
    const [archiveMode, setArchiveMode] = useState('ALL');
    const [timeFilter, setTimeFilter] = useState('ALL');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

    // Selection/Modal state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [selectedItem, setSelectedItem] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Data Loading
    const loadLocalData = useCallback(async () => {
        try {
            const localData = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
            const formattedNotes = await Promise.all(localData.map(async (v) => ({
                ...v,
                is_manual: true,
                card_image: await storage.getCardImage(v.id) || v.card_image || null,
                card_review: await storage.getCardReview(v.id) || v.card_review || '',
                title: await storage.getCardTitle(v.id) || v.title || v.drawer_title || '',
                ai_insight: await storage.getCardAIInsight(v.id) || v.ai_insight || null,
            })));
            setPersonalNotes(formattedNotes);
        } catch (e) {
            console.error('Failed to load local data', e);
        }
    }, []);

    const cleanupLocalVisitArtifacts = useCallback(async (visitId) => {
        await Promise.allSettled([
            storage.deleteCardImage(visitId),
            storage.deleteCardReview(visitId),
            storage.deleteCardTitle(visitId),
            storage.deleteCardAIInsight(visitId),
        ]);
    }, []);

    const loadStats = useCallback(async (signal) => {
        if (!customer?.id) return;
        const { data: latestStats } = await handleApiCall(
            'HistoryScreen.loadStats',
            () => visitService.getCustomerStats(customer.id, signal),
            { showAlert: false }
        );
        if (signal && signal.aborted) return;
        if (latestStats) {
            setStats({
                current_stamps: latestStats.current_stamps,
                visit_count: latestStats.visit_count
            });
        }
    }, [customer?.id]);

    const refreshAllData = useCallback(async (signal) => {
        try {
            await Promise.all([
                refetch(),
                loadLocalData(),
                loadStats(signal)
            ]);
        } catch (e) {
            if (signal && signal.aborted) return;
            console.error(e);
        }
    }, [refetch, loadLocalData, loadStats]);

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

    // Helper: Filter Logic
    const applyTimeFilter = useCallback((data) => {
        if (timeFilter === 'ALL') return data;

        return data.filter(item => {
            const date = new Date(item.visit_date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            if (timeFilter === 'YEAR') {
                return year === selectedYear;
            }
            if (timeFilter === 'MONTH') {
                return year === selectedYear && month === selectedMonth;
            }
            return true;
        });
    }, [timeFilter, selectedYear, selectedMonth]);

    const formattedServerVisits = useMemo(
        () => serverVisits.map((visit) => ({ ...visit, is_manual: false })),
        [serverVisits]
    );

    const allVisits = useMemo(
        () => [...formattedServerVisits, ...personalNotes],
        [formattedServerVisits, personalNotes]
    );

    // Helper: Display Data Construction
    const displayData = useMemo(() => {
        let data = [];

        if (archiveMode === 'ON') data = formattedServerVisits;
        else if (archiveMode === 'OFF') data = personalNotes;
        else {
            data = [...allVisits].sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
        }

        return applyTimeFilter(data);
    }, [archiveMode, formattedServerVisits, personalNotes, allVisits, applyTimeFilter]);

    const displayDataById = useMemo(
        () => new Map(displayData.map((visit) => [visit.id, visit])),
        [displayData]
    );

    // Actions
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
                Alert.alert('오류', '삭제할 항목을 찾을 수 없습니다.');
                return;
            }

            if (itemToDelete.is_manual) {
                const list = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
                const filtered = list.filter(v => v.id !== visitId);
                await storage.save(STORAGE_KEYS.OFFLINE_VISIT_HISTORY, filtered);
                await cleanupLocalVisitArtifacts(visitId);
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
    }, [selectedItem, displayDataById, cleanupLocalVisitArtifacts, loadLocalData, deleteVisit, refreshCustomer]);

    const handleMultiDelete = useCallback(async () => {
        if (selectedIds.size === 0) {
            Alert.alert('선택 없음', '삭제할 항목을 선택해주세요.');
            return;
        }

        Alert.alert(
            '다중 삭제',
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
                                await Promise.allSettled(localIds.map((id) => cleanupLocalVisitArtifacts(id)));
                                await loadLocalData();
                            }

                            showSuccessAlert('DELETE', Alert);
                            setSelectedIds(new Set());
                            setSelectionMode(false);
                            if (serverIds.length > 0) await refreshCustomer();

                        } catch (error) {
                            console.error('다중 삭제 오류:', error);
                            Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
                        }
                    }
                }
            ]
        );
    }, [selectedIds, displayDataById, deleteMultipleVisits, cleanupLocalVisitArtifacts, loadLocalData, refreshCustomer]);

    return {
        state: {
            customer,
            isVisitsLoading,
            refreshing,
            stats: {
                current_stamps: stats.current_stamps || customer?.current_stamps || 0,
                visit_count: stats.visit_count || customer?.visit_count || 0
            },
            visits: allVisits,
            displayData,
            archiveMode,
            timeFilter,
            selectedYear,
            selectedMonth,
            selectionMode,
            selectedIds,
            isModalVisible,
            selectedItem,
        },
        actions: {
            setArchiveMode,
            setTimeFilter,
            setSelectedYear,
            setSelectedMonth,
            setSelectionMode,
            setSelectedIds,
            setIsModalVisible,
            setSelectedItem,
            refreshAllData,
            handleRefresh,
            toggleSelection,
            handleLongPress,
            handleDeleteVisit,
            handleMultiDelete
        }
    };
};
