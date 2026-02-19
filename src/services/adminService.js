import { supabase } from './supabase';

/**
 * 관리자 서비스
 */
export const adminService = {
    /**
     * 관리자 비밀번호 검증 (DB RPC 호출)
     * @param {string} password - 입력받은 비밀번호
     * @returns {object} { success, error }
     */
    async verifyPassword(password) {
        try {
            const { data, error } = await supabase
                .rpc('verify_admin_password', {
                    p_password: password
                });

            if (error) {
                console.error('Admin password verification error:', error);
                return { data: false, error };
            }

            return { data: !!data, error: null };
        } catch (error) {
            console.error('Admin password verification exception:', error);
            return { data: false, error };
        }
    }
};
