import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ArchiveTitleHeader,
  DrawerMark,
  GoldActionButton,
  PremiumCard,
  ScreenContainer,
  StoreContactCard,
} from '../../components';

import { useAuth } from '../../hooks/useAuth';
import { APP_INFO } from '../../constants/Config';
import { DrawerTheme } from '../../constants/DrawerTheme';

const MENU_ITEMS = {
  info: '계정 정보',
  guide: '앱 이용 가이드',
  password: '비밀번호 재설정',
  reports: '버그 접수 · 내역',
  delete: '회원 탈퇴',
};

const SettingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { customer, logout } = useAuth();

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 108 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ArchiveTitleHeader eyebrow="Account Drawer" title="SETTINGS" subtitle="계정 설정 보관함" />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{MENU_ITEMS.info}</Text>
          <PremiumCard style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>닉네임</Text>
              <Text style={styles.infoValue}>{customer?.nickname || '-'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>연락처</Text>
              <Text style={styles.infoValue}>{customer?.isGuest ? '게스트' : customer?.phone_number || '-'}</Text>
            </View>
          </PremiumCard>
        </View>

        <View style={styles.section}>
          <MenuRow label={MENU_ITEMS.guide} onPress={() => navigation.navigate('AppGuide')} />
        </View>

        <StoreContactCard style={styles.storeCard} />

        {customer?.isGuest && (
          <PremiumCard variant="walnut" style={styles.guestCard}>
            <Text style={styles.guestTitle}>회원가입하면 기록이 이어집니다</Text>
            <Text style={styles.guestText}>
              지금 게스트로 남긴 기록은 가입 후에도 그대로 남습니다. 매장 스탬프와 쿠폰은 회원만 쌓을 수 있습니다.
            </Text>
            <GoldActionButton
              title="로그아웃하고 회원가입"
              onPress={() => Alert.alert(
                '회원가입',
                '로그인 화면으로 이동합니다. 지금까지의 기록은 가입 후 그대로 이어집니다.',
                [{ text: '취소', style: 'cancel' }, { text: '이동', onPress: logout }],
              )}
              style={styles.guestButton}
            />
          </PremiumCard>
        )}

        {!customer?.isGuest && (
          <>
            <View style={styles.section}>
              <MenuRow label={MENU_ITEMS.password} onPress={() => navigation.navigate('PasswordReset')} />
            </View>

            <View style={styles.section}>
              <MenuRow label={MENU_ITEMS.reports} onPress={() => navigation.navigate('BugReport')} />
            </View>

            <View style={styles.section}>
              <MenuRow label={MENU_ITEMS.delete} danger onPress={() => navigation.navigate('DeleteAccount')} />
            </View>
          </>
        )}

        <GoldActionButton
          title="LOG OUT"
          onPress={() => Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [{ text: '취소' }, { text: '로그아웃', onPress: logout }])}
          dark
          style={styles.logoutButton}
        />
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Tarot Stamp v{APP_INFO.version}</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const MenuRow = ({ label, onPress, danger = false }) => (
  <TouchableOpacity activeOpacity={0.84} onPress={onPress} disabled={!onPress} accessibilityRole="button">
    <PremiumCard style={[styles.menuCard, danger && styles.menuCardDanger]}>
      <View style={styles.menuContent}>
        <DrawerMark size={18} filled={!danger} />
        <Text style={[styles.menuText, danger && styles.menuTextDanger]}>{label}</Text>
        <Text style={[styles.menuArrow, danger && styles.menuTextDanger]}>ENTER</Text>
      </View>
    </PremiumCard>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: DrawerTheme.goldBrass,
    marginBottom: 8,
    marginLeft: 5,
    letterSpacing: 1.2,
  },
  infoCard: {
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  infoLabel: {
    color: DrawerTheme.mutedIvory,
    fontSize: 13,
  },
  infoValue: {
    color: DrawerTheme.ivory,
    fontWeight: '700',
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(200,163,64,0.18)',
    marginVertical: 4,
  },
  menuCard: {
    padding: 0,
    marginBottom: 0,
  },
  menuCardDanger: {
    borderColor: 'rgba(128,45,58,0.72)',
  },
  menuContent: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 12,
  },
  menuText: {
    flex: 1,
    color: DrawerTheme.ivory,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  menuTextDanger: {
    color: '#C98286',
  },
  menuArrow: {
    color: DrawerTheme.mutedGold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  storeCard: {
    marginTop: 14,
  },
  guestCard: {
    marginTop: 14,
  },
  guestTitle: {
    color: DrawerTheme.ivory,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  guestText: {
    marginTop: 6,
    color: DrawerTheme.mutedIvory,
    fontSize: 13,
    lineHeight: 20,
  },
  guestButton: {
    marginTop: 14,
  },
  logoutButton: {
    marginTop: 18,
  },
  appInfo: {
    marginTop: 34,
    alignItems: 'center',
  },
  appInfoText: {
    color: DrawerTheme.mutedGold,
    fontSize: 11,
    opacity: 0.75,
  },
});

export default SettingsScreen;
