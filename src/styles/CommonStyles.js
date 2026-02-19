import { Platform } from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';

export const CommonStyles = {
    // 고전풍 게시판/섹션 헤더 공통 스타일 (공지, 설정, 쿠폰, 투표 등에 적용)
    headerBoard: {
        backgroundColor: DrawerTheme.woodDark,
        borderRadius: 12,
        paddingVertical: 25,
        paddingHorizontal: 20,
        marginBottom: 25,
        borderWidth: 1.5,
        borderColor: DrawerTheme.woodFrame,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: { elevation: 8 }
        })
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: DrawerTheme.goldBrass,
        letterSpacing: 3,
        fontFamily: Platform.OS === 'ios' ? 'Cochin' : 'serif'
    },
    headerDivider: {
        width: 50,
        height: 2,
        backgroundColor: DrawerTheme.goldBrass,
        marginVertical: 10,
        opacity: 0.7
    },
    subtitle: {
        fontSize: 12,
        color: DrawerTheme.woodLight,
        opacity: 0.9,
        textAlign: 'center'
    }
};
