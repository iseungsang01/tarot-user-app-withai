import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, PremiumCard, ScreenContainer } from '../../components';
import { CommonStyles } from '../../styles/CommonStyles';
import { DrawerTheme } from '../../constants/DrawerTheme';

const GUIDE_SECTIONS = [
  {
    tab: '서랍',
    title: '기록을 서랍에 넣어둡니다',
    lines: [
      '매장에서 상담을 받으면 그날 서랍이 하나 생깁니다. 열어서 내용을 적어두세요.',
      '상담과 무관한 메모는 "개인 서랍 추가"로 직접 만들 수 있습니다.',
      '서랍을 길게 누르면 여러 개를 한 번에 정리할 수 있습니다.',
    ],
  },
  {
    tab: '쿠폰',
    title: '스탬프 10개가 쿠폰이 됩니다',
    lines: [
      '스탬프는 매장에서 직원이 적립해 드립니다.',
      '쿠폰 사용도 매장에서 처리합니다. 쿠폰을 누르고 직원에게 휴대폰을 건네주세요.',
    ],
  },
  {
    tab: '운세',
    title: '하루 한 장, 오늘의 카드',
    lines: [
      '뽑은 카드와 해석은 달력에 남아 나중에 다시 볼 수 있습니다.',
      '같은 날 다시 뽑으려면 광고를 한 번 보면 됩니다.',
    ],
  },
  {
    tab: '소식',
    title: '공지와 투표',
    lines: ['매장 공지와 진행 중인 투표를 확인합니다. 새 소식이 있으면 탭에 점이 표시됩니다.'],
  },
];

const AI_LINES = [
  'AI로 다듬기 — 적어둔 메모의 문장만 자연스럽게 정리합니다.',
  '메모 축약 — 긴 기록을 짧은 문장으로 줄입니다.',
  '기록 모아보기 — 쌓인 기록에서 반복되는 주제를 찾아줍니다.',
];

const AppGuideScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

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
          eyebrow="How To Use"
          title="APP GUIDE"
          subtitle="앱 이용 가이드"
          style={styles.header}
        />

        {GUIDE_SECTIONS.map((section) => (
          <PremiumCard key={section.tab} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.tabBadge}>{section.tab}</Text>
              <Text style={styles.cardTitle}>{section.title}</Text>
            </View>
            {section.lines.map((line) => (
              <View key={line} style={styles.lineRow}>
                <View style={styles.bullet} />
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </PremiumCard>
        ))}

        <PremiumCard variant="walnut" style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.tabBadge}>AI</Text>
            <Text style={styles.cardTitle}>기록을 다듬는 세 가지</Text>
          </View>
          {AI_LINES.map((line) => (
            <View key={line} style={styles.lineRow}>
              <View style={styles.bullet} />
              <Text style={styles.lineText}>{line}</Text>
            </View>
          ))}
          <Text style={styles.footnote}>각 기능은 한 달에 30회까지 쓸 수 있습니다.</Text>
        </PremiumCard>

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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  tabBadge: {
    minWidth: 42,
    textAlign: 'center',
    color: DrawerTheme.bgBlackCherry,
    backgroundColor: DrawerTheme.brassHighlight,
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  cardTitle: {
    flex: 1,
    color: DrawerTheme.ivory,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  lineRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    backgroundColor: DrawerTheme.brightGold,
    opacity: 0.72,
  },
  lineText: {
    flex: 1,
    color: DrawerTheme.mutedIvory,
    fontSize: 13,
    lineHeight: 20,
  },
  footnote: {
    marginTop: 12,
    color: DrawerTheme.brightGold,
    fontSize: 12,
    fontWeight: '800',
  },
});

export default AppGuideScreen;
