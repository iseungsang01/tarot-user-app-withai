import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, PremiumCard, ScreenContainer } from '../../components';
import { CommonStyles } from '../../styles/CommonStyles';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { formatDateDot } from '../../utils/formatters';
import ResponsiveImage from '../../components/common/ResponsiveImage';

const parseContent = (content = '') => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
        }
        parts.push({ type: 'link', text: match[1], url: match[2] });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.substring(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
};

const NoticeDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { notice } = route.params || {};

    if (!notice) {
        return (
            <ScreenContainer safeTop={false} safeBottom={false}>
                <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
                    <Text style={styles.emptyText}>공지 정보를 불러오지 못했습니다.</Text>
                </View>
            </ScreenContainer>
        );
    }

    const parts = parseContent(notice.content || '');

    return (
        <ScreenContainer safeTop={false} safeBottom={false}>
            <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 30 }]}>
                <ArchiveTitleHeader
                    eyebrow="News Drawer"
                    title="NOTICE"
                    subtitle="공지 상세"
                    style={styles.header}
                />

                <PremiumCard style={styles.card}>
                    <Text style={styles.noticeTitle}>{notice.title}</Text>
                    <Text style={styles.date}>{formatDateDot(notice.created_at)}</Text>

                    <ResponsiveImage uri={notice.image_url || null} style={styles.image} />

                    <View style={styles.contentWrap}>
                        {parts.map((part, idx) => (
                            part.type === 'link' ? (
                                <Text key={idx} style={styles.link} onPress={() => Linking.openURL(part.url)}>{part.text}</Text>
                            ) : (
                                <Text key={idx} style={styles.content}>{part.content}</Text>
                            )
                        ))}
                    </View>
                </PremiumCard>

                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.75}
                    style={CommonStyles.backLinkButton}
                >
                    <Text style={CommonStyles.backLinkText}>목록으로 돌아가기</Text>
                </TouchableOpacity>
            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: { paddingHorizontal: 20 },
    header: { marginBottom: 12 },
    card: { padding: 18 },
    noticeTitle: { color: DrawerTheme.ivory, fontSize: 20, fontWeight: '800', marginBottom: 6 },
    date: { color: DrawerTheme.mutedIvory, fontSize: 12, opacity: 0.8, marginBottom: 16 },
    image: { borderRadius: 10, marginBottom: 14 },
    contentWrap: { gap: 8 },
    content: { color: DrawerTheme.ivory, lineHeight: 24, fontSize: 15, opacity: 0.92 },
    link: { color: DrawerTheme.brightGold, textDecorationLine: 'underline', lineHeight: 24, fontSize: 15 },
    emptyText: { color: DrawerTheme.ivory, textAlign: 'center', marginTop: 40 },
});

export default NoticeDetailScreen;
