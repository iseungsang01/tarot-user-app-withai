import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVisits } from './useVisits';
import { useAuth } from './useAuth';
import { visitService } from '../services/visitService';
import { couponService } from '../services/couponService';
import { handleApiCall, showSuccessAlert } from '../utils/errorHandler';

const LOCAL_STORAGE_KEY = 'offline_visit_history';

export const useHistoryLogic = (navigation) => {
    const { customer, refreshCustomer } = useAuth();

    // React Query for server visits
    const { visits: serverVisits, isLoading: isVisitsLoading, refetch, deleteVisit } = useVisits(customer?.id);

    // Local state
    const [personalNotes, setPersonalNotes] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [couponCount, setCouponCount] = useState(0);
    const [archiveMode, setArchiveMode] = useState('ALL');
    const [stats, setStats] = useState({
        current_stamps: customer?.current_stamps || 0,
        visit_count: customer?.visit_count || 0
    });

    // Filter state
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
            const stored = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
            const localData = stored ? JSON.parse(stored) : [];
            const formattedNotes = localData.map(v => ({ ...v, is_manual: true }));
            setPersonalNotes(formattedNotes);
        } catch (e) {
            console.error('Failed to load local data', e);
        }
    }, []);

    const loadStats = useCallback(async () => {
        if (!customer?.id) return;
        const { data: latestStats } = await handleApiCall(
            'HistoryScreen.loadStats',
            () => visitService.getCustomerStats(customer.id),
            { showAlert: false }
        );
        if (latestStats) {
            setStats({
                current_stamps: latestStats.current_stamps,
                visit_count: latestStats.visit_count
            });
        }
    }, [customer?.id]);

    const loadCouponCount = useCallback(async () => {
        if (!customer?.id) return;
        try {
            const { count, error } = await couponService.getValidCouponCount(customer.id);
            if (!error && typeof count === 'number') {
                setCouponCount(count);
            } else {
                setCouponCount(0);
            }
        } catch (err) {
            console.error("loadCouponCount error:", err);
        }
    }, [customer?.id]);

    const refreshAllData = useCallback(async () => {
        try {
            await Promise.all([
                refetch(),
                loadLocalData(),
                loadStats(),
                loadCouponCount()
            ]);
        } catch (e) {
            console.error(e);
        }
    }, [refetch, loadLocalData, loadStats, loadCouponCount]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await refreshAllData();
        setRefreshing(false);
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

    // Helper: Display Data Construction
    const getDisplayData = useCallback(() => {
        let data = [];
        const formattedServerVisits = serverVisits.map(v => ({ ...v, is_manual: false }));

        if (archiveMode === 'ON') data = formattedServerVisits;
        else if (archiveMode === 'OFF') data = personalNotes;
        else data = [...formattedServerVisits, ...personalNotes].sort((a, b) =>
            new Date(b.visit_date) - new Date(a.visit_date)
        );

        return applyTimeFilter(data);
    }, [serverVisits, personalNotes, archiveMode, applyTimeFilter]);

    // Actions
    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleLongPress = (visitId) => {
        if (!selectionMode) {
            setSelectionMode(true);
            setSelectedIds(new Set([visitId]));
        } else {
            toggleSelection(visitId);
        }
    };

    const handleDeleteVisit = async (visitId) => {
        try {
            let itemToDelete = selectedItem;
            if (!itemToDelete) {
                const displayData = getDisplayData();
                itemToDelete = displayData.find(v => v.id === visitId);
            }

            if (!itemToDelete) {
                Alert.alert('오류', '삭제할 항목을 찾을 수 없습니다.');
                return;
            }

            if (itemToDelete.is_manual) {
                const stored = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
                const list = stored ? JSON.parse(stored) : [];
                const filtered = list.filter(v => v.id !== visitId);
                await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
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
    };

    const handleMultiDelete = async () => {
        if (selectedIds.size === 0) {
            Alert.alert('선택 없음', '삭제할 항목을 선택해주세요.');
            return;
        }

        Alert.alert(
            '다중 삭제',
            `선택한 ${selectedIds.size}개의 서랍을 정말 비우시겠습니까?`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const displayData = getDisplayData();
                            const serverIds = [];
                            const localIds = [];

                            selectedIds.forEach(id => {
                                const item = displayData.find(v => v.id === id);
                                if (item) {
                                    item.is_manual ? localIds.push(id) : serverIds.push(id);
                                }
                            });

                            const deletePromises = serverIds.map(id => deleteVisit(id));
                            await Promise.all(deletePromises);

                            if (localIds.length > 0) {
                                const stored = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
                                const list = stored ? JSON.parse(stored) : [];
                                const filtered = list.filter(v => !localIds.includes(v.id));
                                await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
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
    };

    return {
        state: {
            customer,
            isVisitsLoading,
            refreshing,
            stats,
            couponCount,
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
        },
        getDisplayData,
    };
};
