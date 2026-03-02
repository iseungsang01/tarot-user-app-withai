import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../../components';
import { CommonStyles } from '../../styles/CommonStyles';
import { DrawerTheme } from '../../constants/DrawerTheme';

const NoticeDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { notice } = route.params || {};

    const imageUri = notice?.image_url || null;

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

    if (!notice) {
        return (
            <GradientBackground>
                <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
                    <Text style={styles.emptyText}>공지 정보를 불러오지 못했습니다.</Text>
                </View>
            </GradientBackground>
        );
    }

    const parts = parseContent(notice.content || '');

    return (
        <GradientBackground>
            <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }]}>
                <View style={styles.header}>
                    <View style={styles.titleRow}><Text style={styles.title}>NOTICE DETAIL</Text></View>
                    <View style={styles.headerDivider} />
                    <Text style={styles.subtitle}>공지 상세 내용을 확인하세요</Text>
                </View>

                <View style={styles.card}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.back}>← 목록으로</Text>
                    </TouchableOpacity>
                    <Text style={styles.noticeTitle}>{notice.title}</Text>
                    <Text style={styles.date}>{new Date(notice.created_at).toLocaleDateString()}</Text>

                    {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}

                    <View style={styles.contentWrap}>
                        {parts.map((part, idx) => (
                            part.type === 'link' ? (
                                <Text key={idx} style={styles.link} onPress={() => Linking.openURL(part.url)}>{part.text}</Text>
                            ) : (
                                <Text key={idx} style={styles.content}>{part.content}</Text>
                            )
                        ))}
                    </View>
                </View>
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { paddingHorizontal: 20 },
    header: CommonStyles.headerBoard,
    titleRow: CommonStyles.titleRow,
    title: CommonStyles.title,
    headerDivider: CommonStyles.headerDivider,
    subtitle: CommonStyles.subtitle,
    card: {
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
        borderRadius: 14,
        padding: 18,
    },
    back: { color: DrawerTheme.goldBrass, fontWeight: '700', marginBottom: 14 },
    noticeTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
    date: { color: DrawerTheme.woodLight, marginBottom: 16 },
    image: { width: '100%', height: 220, borderRadius: 10, marginBottom: 14 },
    contentWrap: { gap: 8 },
    content: { color: '#ddd', lineHeight: 24, fontSize: 15 },
    link: { color: DrawerTheme.goldBrass, textDecorationLine: 'underline', lineHeight: 24, fontSize: 15 },
    emptyText: { color: '#fff', textAlign: 'center', marginTop: 40 }
});

export default NoticeDetailScreen;
