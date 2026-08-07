import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { setDialogHost } from '../../utils/dialog';

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

/**
 * dialog.alert() 의 렌더링 호스트. App.js 에 한 번만 마운트한다.
 * OS 기본 Alert 대신 서랍 테마에 맞춘 다이얼로그를 띄운다.
 */
export const AppDialog = () => {
  const [request, setRequest] = useState(null);
  const resolveRef = useRef(null);

  useEffect(() => {
    setDialogHost((next, resolve) => {
      resolveRef.current = resolve;
      setRequest(next);
    });
    return () => setDialogHost(null);
  }, []);

  const close = useCallback((action) => {
    setRequest(null);
    // 화면 전환을 부르는 onPress 가 많아 닫힘 애니메이션 뒤에 실행한다
    setTimeout(() => {
      action?.onPress?.();
      resolveRef.current?.();
      resolveRef.current = null;
    }, 0);
  }, []);

  const onRequestClose = useCallback(() => {
    const cancel = request?.actions.find((a) => a.style === 'cancel');
    close(cancel ?? (request?.actions.length === 1 ? request.actions[0] : undefined));
  }, [request, close]);

  if (!request) return null;

  const { title, message, actions } = request;
  // 버튼이 3개 이상이면 가로로 좁아져 글자가 깨진다
  const stacked = actions.length > 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <LinearGradient
          colors={[DrawerTheme.bgDeepPurple, DrawerTheme.bgBlackCherry]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.brassLip} />

          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={[styles.actionRow, stacked && styles.actionColumn]}>
            {actions.map((action, index) => {
              const isDestructive = action.style === 'destructive';
              const isCancel = action.style === 'cancel';
              // 취소가 아닌 마지막 버튼을 기본 동작으로 강조한다
              const isPrimary = !isCancel && !isDestructive && index === actions.length - 1;

              return (
                <TouchableOpacity
                  key={`${action.text}-${index}`}
                  accessibilityRole="button"
                  activeOpacity={0.84}
                  onPress={() => close(action)}
                  style={[
                    styles.action,
                    stacked && styles.actionFull,
                    isPrimary && styles.actionPrimary,
                    isDestructive && styles.actionDestructive,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.actionText,
                      isPrimary && styles.actionTextPrimary,
                      isDestructive && styles.actionTextDestructive,
                      isCancel && styles.actionTextCancel,
                    ]}
                  >
                    {action.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(5,0,8,0.78)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: DrawerTheme.archiveBorderStrong,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  brassLip: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 2,
    opacity: 0.7,
    backgroundColor: DrawerTheme.brassHighlight,
  },
  title: {
    color: DrawerTheme.brightGold,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '900',
    fontFamily: serif,
    letterSpacing: 0.3,
  },
  message: {
    marginTop: 10,
    color: DrawerTheme.ivory,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.9,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
  },
  actionColumn: {
    flexDirection: 'column',
  },
  action: {
    flex: 1,
    minHeight: 46,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(224,184,90,0.28)',
    backgroundColor: 'rgba(244,232,208,0.06)',
  },
  actionFull: {
    flex: 0,
    width: '100%',
  },
  actionPrimary: {
    borderColor: DrawerTheme.brassHighlight,
    backgroundColor: 'rgba(184,135,53,0.26)',
  },
  actionDestructive: {
    borderColor: 'rgba(200,90,110,0.5)',
    backgroundColor: DrawerTheme.archiveDanger,
  },
  actionText: {
    color: DrawerTheme.ivory,
    fontSize: 14,
    fontWeight: '800',
  },
  actionTextPrimary: {
    color: DrawerTheme.brightGold,
    fontWeight: '900',
  },
  actionTextDestructive: {
    color: '#F3C9CE',
    fontWeight: '900',
  },
  actionTextCancel: {
    color: DrawerTheme.mutedIvory,
  },
});
