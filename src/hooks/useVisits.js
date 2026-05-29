import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { storage } from '../utils/storage';

const VISITS_KEY = ['visits'];

export const useVisits = (customerId) => {
    const queryClient = useQueryClient();

    // 1. 읽기 (Read)
    const query = useQuery({
        queryKey: [...VISITS_KEY, customerId],
        queryFn: async () => {
            if (!customerId) return [];

            // ✅ 게스트 모드: 서버 요청 없이 빈 배열 반환
            if (customerId === 'guest') {
                const allImages = await storage.getAllCardImages();
                const allReviews = await storage.getAllCardReviews(); // storage는 로컬이므로 게스트도 접근 가능 (로컬 데이터 확인용)
                // 하지만 DB 데이터가 없으므로 mapping할 ID가 없음. 
                // 게스트 매뉴얼 모드는 로컬 스토리지 별도 키를 사용하므로 여기서는 빈 배열 리턴이 맞음.
                // 만약 매뉴얼 데이터와 통합된다면 로직이 다르겠지만, HistoryScreen에서 로컬은 따로 로드함.
                return [];
            }

            const { data, error } = await supabase
                .from('visit_history')
                .select('id, customer_id, visit_date')
                .eq('customer_id', customerId)
                .eq('is_deleted', false)
                .order('visit_date', { ascending: false });

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
            const { error } = await supabase
                .from('visit_history')
                .update({ is_deleted: true })
                .eq('id', visitId);

            if (error) throw error;

            // 로컬 데이터도 정리
            await storage.deleteCardImage(visitId);
            await storage.deleteCardReview(visitId);
            await storage.deleteCardTitle(visitId);
            await storage.deleteCardAIInsight(visitId);
            return visitId;
        },
        onSuccess: () => {
            // 목록 새로고침
            queryClient.invalidateQueries([...VISITS_KEY, customerId]);
        }
    });

    // 2-2. 다중 삭제 (Batch Mutation)
    const deleteMultipleMutation = useMutation({
        mutationFn: async (visitIds) => {
            if (!visitIds || visitIds.length === 0) return [];

            const { error } = await supabase
                .from('visit_history')
                .update({ is_deleted: true })
                .in('id', visitIds);

            if (error) throw error;

            // 로컬 데이터 병렬 정리
            await Promise.all(visitIds.flatMap(id => [
                storage.deleteCardImage(id),
                storage.deleteCardReview(id),
                storage.deleteCardTitle(id),
                storage.deleteCardAIInsight(id)
            ]));

            return visitIds;
        },
        onSuccess: () => {
            // 목록 새로고침
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
