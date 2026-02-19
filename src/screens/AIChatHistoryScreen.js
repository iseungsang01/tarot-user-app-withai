/**
 * src/screens/AIChatHistoryScreen.js
 * AI 상담 과거 내역 목록 화면
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../components';
import { DrawerTheme } from '../constants/DrawerTheme';
import { storage } from '../utils/storage';
import { useAuth } from '../hooks/useAuth';

const AIChatHistoryScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { customer } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, [customer?.id]);

    const loadSessions = async () => {
        if (!customer?.id) return;
        setLoading(true);
        const data = await storage.getAIChatSessions(customer.id);
        setSessions(data);
        setLoading(false);
    };

    const handleDelete = (sessionId) => {
        Alert.alert(
            '내역 삭제',
            '이 상담 내역을 삭제할까요?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => {
                        await storage.deleteAIChatSession(customer.id, sessionId);
                        loadSessions();
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => {
        const date = new Date(item.date);
        const dateStr = `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

        return (
            <TouchableOpacity
                style={styles.sessionItem}
                onPress={() => navigation.navigate('AIChat', { session: item })}
                activeOpacity={0.7}
            >
                <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.sessionMeta}>
                        {dateStr} {timeStr} • 메시지 {item.messageCount}개
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id)}
                >
                    <Text style={styles.deleteIcon}>✕</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <GradientBackground>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* 헤더 */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>과거 상담 보관함</Text>
                    <View style={{ width: 40 }} />
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={DrawerTheme.goldBright} size="large" />
                    </View>
                ) : sessions.length === 0 ? (
                    <View style={styles.center}>
                        <Text style={styles.emptyText}>보관된 상담 내역이 없습니다.{"\n"}대화를 종료할 때 내역이 저장됩니다.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={sessions}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                    />
                )}
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    backText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: DrawerTheme.goldBright },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
    listContent: { padding: 20, gap: 12 },
    sessionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sessionInfo: { flex: 1 },
    sessionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 6 },
    sessionMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
    deleteBtn: { padding: 8 },
    deleteIcon: { color: 'rgba(255,255,255,0.3)', fontSize: 18 },
});

export default AIChatHistoryScreen;
