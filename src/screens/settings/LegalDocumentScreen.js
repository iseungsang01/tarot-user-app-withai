import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, PremiumCard, ScreenContainer } from '../../components';
import { CommonStyles } from '../../styles/CommonStyles';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { LEGAL_DOCUMENTS, TERMS_OF_SERVICE } from '../../constants/legal';

const EYEBROW = {
  terms: 'Terms Of Service',
  privacy: 'Privacy Policy',
};

const TITLE = {
  terms: 'TERMS',
  privacy: 'PRIVACY',
};

/** blocks 는 문자열(문단) · { subheading } · { list } 세 가지뿐이다. */
const Block = ({ block }) => {
  if (typeof block === 'string') return <Text style={styles.paragraph}>{block}</Text>;

  if (block.subheading) return <Text style={styles.subheading}>{block.subheading}</Text>;

  return (
    <View style={styles.list}>
      {block.list.map((item) => (
        <View key={item} style={styles.listRow}>
          <View style={styles.bullet} />
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
};

const LegalDocumentScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const document = LEGAL_DOCUMENTS[route?.params?.documentId] || TERMS_OF_SERVICE;

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
          eyebrow={EYEBROW[document.id]}
          title={TITLE[document.id]}
          subtitle={document.title}
          style={styles.header}
        />

        <Text style={styles.meta}>
          {`버전 ${document.version} · 시행일 ${document.effectiveDate}`}
        </Text>

        {document.sections.map((section) => (
          <PremiumCard key={section.heading} style={styles.card}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </PremiumCard>
        ))}

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          style={CommonStyles.backLinkButton}
        >
          <Text style={CommonStyles.backLinkText}>돌아가기</Text>
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
    marginBottom: 6,
  },
  meta: {
    color: DrawerTheme.mutedPurple,
    fontSize: 11,
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 14,
  },
  card: {
    marginBottom: 12,
  },
  heading: {
    color: DrawerTheme.brightGold,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  subheading: {
    color: DrawerTheme.ivory,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 2,
  },
  paragraph: {
    color: DrawerTheme.ivory,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
  },
  list: {
    marginTop: 4,
  },
  listRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    backgroundColor: DrawerTheme.brightGold,
  },
  listText: {
    flex: 1,
    color: DrawerTheme.ivory,
    fontSize: 13,
    lineHeight: 21,
  },
});

export default LegalDocumentScreen;
