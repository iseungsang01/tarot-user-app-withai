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

    /**
     * 삭제 뒤 서랍 목록을 다시 읽어온다.
     *
     * - onSuccess 가 아니라 onSettled 에서 부른다. 일부만 지워지고 실패한
     *   경우에도 화면과 서버가 어긋난 채 남으면 안 된다.
     * - Promise 를 돌려주면 react-query 가 이걸 기다렸다가 mutateAsync 를
     *   resolve 한다. 덕분에 호출부에서 "삭제됐습니다" 를 띄우는 시점에는
     *   이미 목록에서 서랍이 빠져 있다.
     */
    const refreshVisits = () => queryClient.invalidateQueries({ queryKey: [...VISITS_KEY, customerId] });

    // 2. 삭제 (Mutation)
    const deleteMutation = useMutation({
        mutationFn: async (visitId) => {
            const { error } = await visitService.deleteVisit(visitId, customerId);

            if (error) throw error;
            return visitId;
        },
        onSettled: refreshVisits,
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
        onSettled: refreshVisits,
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
