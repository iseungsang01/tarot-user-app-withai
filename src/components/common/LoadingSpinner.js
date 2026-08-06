import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';

/**
 * 로딩 ?�피??컴포?�트
 * ?�이??로딩 �??�시
 * 
 * @param {string} message - 로딩 메시지 (기본: '로딩 중..')
 * @param {string} size - ?�피???�기 ('small' | 'large')
 */
export const LoadingSpinner = ({ message = '로딩 중..', size = 'large' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={DrawerTheme.goldBright} />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: DrawerTheme.mutedIvory,
    fontSize: 16,
    marginTop: 10,
  },
});