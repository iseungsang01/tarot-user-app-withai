import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitService } from '../services/visitService';
import { storage } from '../utils/storage';

const VISITS_KEY = ['visits'];

export const useVisits = (customerId) => {
    const queryClient = useQueryClient();

    // 1. 읽기 (Read)
    const query = useQuery({
        queryKey: [...VISITS_KEY, customerId],
        queryFn: async () => {
            if (!customerId) return [];

            // 게스트는 서버 방문 기록이 없다.
            // 게스트의 로컬 기록은 OFFLINE_VISIT_HISTORY 키를 쓰며 HistoryScreen이 따로 로드한다.
            if (customerId === 'guest') return [];

            const { data, error } = await visitService.getVisits(customerId);

            if (error) throw error;

            // 이미지 캐시와 병합 (UI 표시용)
            const [allImages, allReviews, allTitles, allAIInsights] = await Promise.all([
                storage.getAllCardImages(),
                storage.getAllCardReviews(),
                storage.getAllCardTitles(),
                storage.getAllCardAIInsights()
            ]);

            return data.map(visit => ({
                ...visit,
                card_image: allImages[visit.id] || null,
                card_review: allReviews[visit.id] || null,
                title: allTitles[visit.id] || '',
                ai_insight: allAIInsights[visit.id] || null,
            }));
        },
        enabled: !!customerId,
        staleTime: 1000 * 60 * 5, // 5분간 Fresh 유지
    });

    // 2. 삭제 (Mutation)
    const deleteMutation = useMutation({
        mutationFn: async (visitId) => {
            const { error } = await visitService.deleteVisit(visitId, customerId);

            if (error) throw error;
            return visitId;
        },
        onSuccess: () => {
            // Refresh the drawer list after clearing local annotations.
            queryClient.invalidateQueries([...VISITS_KEY, customerId]);
        }
    });

    // 2-2. 다중 삭제 (Batch Mutation)
    const deleteMultipleMutation = useMutation({
        mutationFn: async (visitIds) => {
            if (!visitIds || visitIds.length === 0) return [];

            const results = await Promise.all(visitIds.map(id => visitService.deleteVisit(id, customerId)));
            const failed = results.find(result => result?.error);
            if (failed) throw failed.error;

            return visitIds;
        },
        onSuccess: () => {
            // Refresh the drawer list after clearing local annotations.
            queryClient.invalidateQueries([...VISITS_KEY, customerId]);
        }
    });

    return {
        visits: query.data || [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
        deleteVisit: deleteMutation.mutateAsync,
        deleteMultipleVisits: deleteMultipleMutation.mutateAsync,
        isDeleting: deleteMutation.isPending || deleteMultipleMutation.isPending
    };
};
