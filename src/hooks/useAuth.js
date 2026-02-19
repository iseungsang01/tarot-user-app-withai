import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * 인증 Hook
 * AuthContext를 편리하게 사용하기 위한 커스텀 훅
 * 
 * @returns {object} { customer, loading, login, logout, refreshCustomer }
 * 
 * @example
 * const { customer, login, logout } = useAuth();
 * 
 * // 로그인
 * const result = await login('010-1234-5678');
 * if (result.success) {
 *   console.log('로그인 성공:', customer);
 * }
 * 
 * // 고객 정보 사용
 * if (customer) {
 *   console.log(customer.nickname);
 *   console.log(customer.current_stamps);
 * }
 * 
 * // 로그아웃
 * await logout();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  
  return context;
};