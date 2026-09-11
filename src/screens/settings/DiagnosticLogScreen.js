import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, GoldActionButton, PremiumCard, ScreenContainer } from '../../components';
import { CommonStyles } from '../../styles/CommonStyles';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { APP_INFO } from '../../constants/Config';
import { clearDiagnostics, describeDevice, readDiagnostics } from '../../utils/diagnostics';
import { dialog } from '../../utils/dialog';

/**
 * 진단 기록 화면.
 *
 * 기기에만 쌓인 에러 로그를 그대로 보여준다. 본문을 selectable 로 둔 것은
 * 길게 눌러 복사할 수 있게 하려는 것이다 — 클립보드 패키지를 새로 넣으면
 * dev-client 를 다시 빌드해야 해서, 네이티브 의존성 없이 되는 쪽을 골랐다.
 */

// 로그 시각은 기기 로컬 시각으로 보여준다. 접수된 원문은 ISO(UTC)로 남는다
const formatTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const DiagnosticLogScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const device = describeDevice();

  const load = useCallback(async () => {
    setEntries(await readDiagnostics());
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClear = () => {
    dialog.alert('진단 기록 삭제', '기기에 쌓인 기록을 모두 지웁니다. 지우면 되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        onPress: async () => {
          await clearDiagnostics();
          await load();
        },
      },
    ]);
  };

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ArchiveTitleHeader
          eyebrow="Diagnostics"
          title="DIAGNOSTIC LOG"
          subtitle="진단 기록"
          style={styles.header}
        />

        <PremiumCard variant="walnut" style={styles.card}>
          <Text style={styles.deviceLine} selectable>
            {`${APP_INFO.name} ${APP_INFO.version} · ${device.os}${device.device ? ` · ${device.device}` : ''}`}
          </Text>
          <Text style={styles.noticeText}>
            이 기록은 휴대폰 안에만 저장됩니다. 버그를 접수하면 최근 기록이 접수 내용과 함께 전달되어 원인을 찾는 데 쓰입니다.
          </Text>
        </PremiumCard>

        {loaded && entries.length === 0 && (
          <PremiumCard style={styles.card}>
            <Text style={styles.emptyText}>아직 기록된 문제가 없습니다.</Text>
          </PremiumCard>
        )}

        {entries.map((entry, index) => (
          <PremiumCard key={`${entry.t}-${index}`} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryTime}>{formatTime(entry.t)}</Text>
              {!!entry.code && <Text style={styles.entryCode}>{entry.code}</Text>}
            </View>
            <Text style={styles.entryContext} selectable>{entry.ctx}</Text>
            <Text style={styles.entryMessage} selectable>{entry.msg}</Text>
            {!!entry.extra && (
              <Text style={styles.entryExtra} selectable>{JSON.stringify(entry.extra)}</Text>
            )}
          </PremiumCard>
        ))}

        <GoldActionButton
          title="버그 접수하기"
          onPress={() => navigation.navigate('BugReport')}
          style={styles.action}
        />

        {entries.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleClear}
            activeOpacity={0.75}
            style={CommonStyles.backLinkButton}
          >
            <Text style={styles.clearText}>기록 모두 지우기</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          style={CommonStyles.backLinkButton}
        >
          <Text style={CommonStyles.backLinkText}>설정으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
  },
  deviceLine: {
    color: DrawerTheme.ivory,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  noticeText: {
    color: DrawerTheme.mutedIvory,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyText: {
    color: DrawerTheme.mutedIvory,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  entryCard: {
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  entryTime: {
    color: DrawerTheme.mutedIvory,
    fontSize: 11,
    fontWeight: '700',
  },
  entryCode: {
    color: DrawerTheme.bgBlackCherry,
    backgroundColor: DrawerTheme.brassHighlight,
    borderRadius: 5,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '900',
  },
  entryContext: {
    color: DrawerTheme.brassHighlight,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  entryMessage: {
    color: DrawerTheme.ivory,
    fontSize: 13,
    lineHeight: 19,
  },
  entryExtra: {
    color: DrawerTheme.mutedPurple,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  action: {
    marginTop: 8,
  },
  clearText: {
    color: DrawerTheme.mutedPurple,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default DiagnosticLogScreen;
